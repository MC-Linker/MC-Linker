import { PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import keys from '../../../utilities/keys.js';
import { getEmbed } from '../../../utilities/messages.js';
import logger from '../../../utilities/logger.js';
import {
    CHAT_WEBHOOK_LEGACY_NAMES,
    CHAT_WEBHOOK_NAME,
    CONSOLE_AFFINITY_HEADROOM,
    CONSOLE_SCALE_CHAR_THRESHOLD,
    getChatWebhookCreationOptions,
    IDLE_WEBHOOK_PRUNE_COOLDOWN_MS,
    MAX_WEBHOOKS_PER_CHANNEL,
    PRUNE_CHECK_INTERVAL_MS,
} from './ChatConstants.js';


export default class WebhookPoolManager {

    /**
     * Caches webhook tokens by webhook ID for use with WebhookClient.
     * Tokens are periodically refreshed to avoid stale-cache send failures.
     * @type {Map<string, { token: string, cachedAt: number }>}
     */
    webhookTokens = new Map();

    /**
     * Tracks the last time each webhook was actively used for enqueueing.
     * @type {Map<string, number>}
     */
    webhookLastActive = new Map();

    /**
     * Tracks the last time idle-webhook pruning was checked per channel.
     * @type {Map<string, number>}
     */
    lastPruneCheck = new Map();

    /** @type {import('./ChatDispatchHandler.js').default} */
    dispatchHandler;

    /** @type {Map<string, { id: string, raw: string, hasAnsi: boolean, webhookId: string }>} */
    lastConsoleMessages;

    /**
     * Returns whether any webhook queue for the given channels exceeds the batch threshold,
     * indicating the system is under enough load to skip expensive operations like mention parsing.
     * @param {ChatChannelData[]} channels - The chat channels to check.
     * @returns {boolean}
     */
    isUnderHighLoad(channels) {
        for(const channel of channels) {
            for(const webhookId of channel.webhooks ?? []) {
                if(this.dispatchHandler.getQueueSize(webhookId) > this.dispatchHandler.batchThreshold) return true;
            }
        }
        return false;
    }

    /**
     * Selects the best webhook for a chat channel, distributing load across the webhook pool.
     * Creates additional webhooks when all existing ones are under pressure, up to the channel's available capacity.
     * Periodically prunes idle excess webhooks.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @param {QueueItem['kind']} kind - The payload kind used to determine scale-up pressure.
     * @returns {Promise<?string>} The selected webhook ID, or null if no webhook could be ensured.
     */
    async selectWebhook(channelConfig, server, guild, kind) {
        const firstId = await this.ensureWebhookForChatChannel(channelConfig, server, guild);
        if(!firstId) return null;

        const now = Date.now();

        // Periodically prune idle webhooks (at most once per interval per channel)
        const lastPrune = this.lastPruneCheck.get(channelConfig.id) ?? 0;
        if(now - lastPrune > PRUNE_CHECK_INTERVAL_MS && channelConfig.webhooks.length > 1) {
            this.lastPruneCheck.set(channelConfig.id, now);
            await this.pruneIdleWebhooks(channelConfig, server, guild);
        }

        const webhooks = channelConfig.webhooks;

        let bestId = webhooks[0]; // Default to the first webhook
        let bestSize;
        if(kind === 'console') {
            // Prefer the webhook that sent the last console message (only it can edit),
            // but only while the message has enough headroom for more content.
            const lastMsg = this.lastConsoleMessages.get(channelConfig.id);
            if(webhooks.includes(lastMsg.webhookId)) {
                const charLimit = lastMsg.hasAnsi ? 1000 : 2000;
                if(lastMsg.raw.length < charLimit - CONSOLE_AFFINITY_HEADROOM) {
                    this.webhookLastActive.set(lastMsg.webhookId, now);
                    return lastMsg.webhookId;
                }
            }

            // Fall through to least-loaded by queued character count
            bestSize = this.dispatchHandler.getQueuedConsoleChars(webhooks[0]);
            for(let i = 1; i < webhooks.length; i++) {
                const chars = this.dispatchHandler.getQueuedConsoleChars(webhooks[i]);
                if(chars < bestSize) {
                    bestId = webhooks[i];
                    bestSize = chars;
                }
            }
        }
        else {
            // For chat, find the least-loaded webhook by queue size
            bestSize = this.dispatchHandler.getQueueSize(webhooks[0]);
            for(let i = 1; i < webhooks.length; i++) {
                const size = this.dispatchHandler.getQueueSize(webhooks[i]);
                if(size < bestSize) {
                    bestId = webhooks[i];
                    bestSize = size;
                }
            }
        }

        // Scale up only when mode-specific pressure threshold is exceeded.
        // Chat and embeds use batch threshold, console uses queued character pressure.
        const shouldScaleUp = kind === 'console' ?
            bestSize > CONSOLE_SCALE_CHAR_THRESHOLD :
            bestSize > this.dispatchHandler.batchThreshold;

        if(shouldScaleUp) {
            const newId = await this.tryScaleUp(channelConfig, server, guild);
            if(newId) {
                this.webhookLastActive.set(newId, now);
                return newId;
            }
        }

        this.webhookLastActive.set(bestId, now);
        return bestId;
    }

    /**
     * Attempts to scale up the webhook pool by creating an additional webhook.
     * Checks the channel's remaining webhook capacity before creating.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @returns {Promise<?string>} The new webhook ID, or null if capacity is exhausted or creation failed.
     */
    async tryScaleUp(channelConfig, server, guild) {
        const discordChannel = await guild.channels.fetch(channelConfig.id).catch(() => null);
        if(!discordChannel) return null;

        const webhookChannel = discordChannel.isThread() ? discordChannel.parent : discordChannel;
        if(!webhookChannel) return null;

        const availableSlots = await this.getAvailableWebhookSlots(webhookChannel);
        if(availableSlots <= 0) return null;

        return this.createAdditionalWebhook(channelConfig, server, guild, webhookChannel);
    }

    /**
     * Returns the number of additional webhooks that can be created in a channel.
     * Accounts for all existing webhooks (from any source) against Discord's per-channel limit of 15.
     * @param {import('discord.js').TextChannel} channel - The webhook-container channel (thread parent or text channel).
     * @returns {Promise<number>} The number of available webhook slots.
     */
    async getAvailableWebhookSlots(channel) {
        const existingWebhooks = await channel.fetchWebhooks().catch(() => null);
        if(!existingWebhooks) return 0;
        return Math.max(0, MAX_WEBHOOKS_PER_CHANNEL - existingWebhooks.size);
    }

    /**
     * Creates an additional webhook and adds it to the channel's webhook pool.
     * Does not check capacity — callers should verify via {@link getAvailableWebhookSlots} first.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @param {import('discord.js').TextChannel} webhookChannel - The channel to create the webhook in.
     * @returns {Promise<?string>} The new webhook ID, or null if creation failed.
     */
    async createAdditionalWebhook(channelConfig, server, guild, webhookChannel) {
        const canManageWebhooks = webhookChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageWebhooks);
        if(!canManageWebhooks) return null;

        const webhookId = await this.createWebhook(channelConfig, server, guild, webhookChannel, webhookChannel);
        if(webhookId) logger.debug(`[Socket.io][Chat] Scaled up webhook pool for channel ${channelConfig.id} (total=${channelConfig.webhooks.length})`);
        return webhookId;
    }

    /**
     * Prunes idle webhooks from a channel's pool, keeping at least one webhook.
     * A webhook is considered idle if it hasn't been used for enqueueing within the prune cooldown period
     * and its dispatch queue is empty.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @returns {Promise<void>}
     */
    async pruneIdleWebhooks(channelConfig, server, guild) {
        if(!channelConfig.webhooks || channelConfig.webhooks.length <= 1) return;

        const now = Date.now();
        const toRemove = [];

        for(const webhookId of channelConfig.webhooks) {
            if(channelConfig.webhooks.length - toRemove.length <= 1) break; // Keep at least one
            const lastActive = this.webhookLastActive.get(webhookId) ?? 0;
            const queueSize = this.dispatchHandler.getQueueSize(webhookId);
            if(queueSize === 0 && now - lastActive > IDLE_WEBHOOK_PRUNE_COOLDOWN_MS)
                toRemove.push(webhookId);
        }

        if(toRemove.length === 0) return;

        for(const webhookId of toRemove) {
            try {
                await guild.client.deleteWebhook(webhookId);
            }
            catch(_) {}
            this.webhookLastActive.delete(webhookId);
            this.webhookTokens.delete(webhookId);
        }

        channelConfig.webhooks = channelConfig.webhooks.filter(id => !toRemove.includes(id));

        const regChannel = await server.protocol.addChatChannel({
            id: channelConfig.id,
            webhooks: channelConfig.webhooks,
            types: channelConfig.types,
            allowDiscordToMinecraft: channelConfig.allowDiscordToMinecraft,
        });

        if(regChannel) await server.edit({ chatChannels: regChannel.data });

        logger.debug(`[Socket.io][Chat] Pruned ${toRemove.length} idle webhook(s) for channel ${channelConfig.id} (remaining=${channelConfig.webhooks.length})`);
    }

    /**
     * Ensures at least one webhook exists for the given chat channel configuration, creating one if necessary.
     * @param {ChatChannelData} channel - The chat channel configuration to ensure a webhook for.
     * @param {ServerConnection} server - The server connection that owns this chat channel.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @returns {Promise<?string>} The first webhook ID, or null if it could not be ensured.
     */
    async ensureWebhookForChatChannel(channel, server, guild) {
        if(channel.webhooks?.length > 0) return channel.webhooks[0];

        const discordChannel = await guild.channels.fetch(channel.id)
            .catch(async err => {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) await this.removeChatChannel(server, channel);
                return null;
            });
        if(!discordChannel) return null;

        const canManageWebhooks = discordChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageWebhooks);
        if(!canManageWebhooks) {
            await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission)] }).catch(() => {});
            return null;
        }

        const webhookChannel = discordChannel.isThread() ? discordChannel.parent : discordChannel;
        if(!webhookChannel) return null;

        return this.createWebhook(channel, server, guild, webhookChannel, discordChannel);
    }

    /**
     * Removes a chat channel configuration from the server and cleans up associated in-memory state.
     * @param {ServerConnection} server - The server connection that owns this chat channel.
     * @param {ChatChannelData} channel - The chat channel configuration to remove.
     * @returns {Promise<void>}
     */
    async removeChatChannel(server, channel) {
        const regChannel = await server.protocol.removeChatChannel(channel);
        if(!regChannel) return;

        this.lastConsoleMessages.delete(channel.id);
        this.lastPruneCheck.delete(channel.id);
        for(const webhookId of channel.webhooks ?? []) {
            this.webhookLastActive.delete(webhookId);
            this.webhookTokens.delete(webhookId);
        }
        await server.edit({ chatChannels: regChannel.data });
    }

    /**
     * Creates a new webhook or, if that fails, finds a reusable webhook and registers it with the server plugin, caching its token locally.
     * On failure, rolls back the local state and deletes the webhook.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @param {import('discord.js').TextChannel} webhookChannel - The channel to create the webhook in.
     * @param {import('discord.js').TextChannel} errorChannel - The channel to send error messages to.
     * @returns {Promise<?string>} The webhook ID, or null if creation or registration failed.
     */
    async createWebhook(channelConfig, server, guild, webhookChannel, errorChannel) {
        let webhook;
        try {
            webhook = await webhookChannel.createWebhook(getChatWebhookCreationOptions());
        }
        catch(err) {
            webhook = await this.findReusableChatWebhook(webhookChannel, guild.client.user.id);
            if(!webhook) {
                logger.error(err, `[Socket.io][Chat] Failed creating webhook for channel ${channelConfig.id}`);
                await errorChannel.send({ embeds: [getEmbed(keys.commands.chatchannel.errors.could_not_create_webhook)] }).catch(() => {});
                return null;
            }
        }

        if(!channelConfig.webhooks) channelConfig.webhooks = [];
        channelConfig.webhooks.push(webhook.id);
        this.webhookTokens.set(webhook.id, { token: webhook.token, cachedAt: Date.now() });

        const regChannel = await server.protocol.addChatChannel({
            id: channelConfig.id,
            webhooks: channelConfig.webhooks,
            types: channelConfig.types,
            allowDiscordToMinecraft: channelConfig.allowDiscordToMinecraft,
        });

        if(!regChannel) {
            channelConfig.webhooks.pop();
            this.webhookTokens.delete(webhook.id);
            await webhook.delete().catch(() => {});
            await errorChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_sync_webhooks)] }).catch(() => {});
            return null;
        }

        await server.edit({ chatChannels: regChannel.data });
        return webhook.id;
    }

    /**
     * Attempts to find an existing bot-owned webhook in the channel that can be reused.
     * @param {import('discord.js').TextChannel} channel - The webhook container channel (thread parent or text channel).
     * @param {string} botId - The current bot user id.
     * @returns {Promise<?import('discord.js').Webhook>}
     */
    async findReusableChatWebhook(channel, botId) {
        const existingWebhooks = await channel.fetchWebhooks().catch(() => null);
        if(!existingWebhooks) return null;

        return existingWebhooks.find(webhook => {
            if(webhook.owner?.id !== botId) return false;
            return webhook.name === CHAT_WEBHOOK_NAME || CHAT_WEBHOOK_LEGACY_NAMES.has(webhook.name);
        }) ?? null;
    }
}
