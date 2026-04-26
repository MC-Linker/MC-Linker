import Discord, { PermissionFlagsBits, RateLimitError, RESTJSONErrorCodes } from 'discord.js';
import keys from '../../../utilities/keys.js';
import { getEmbed } from '../../../utilities/messages.js';
import rootLogger from '../../../utilities/logger/Logger.js';
import features from '../../../utilities/logger/features.js';
import { trackError } from '../../../structures/analytics/AnalyticsCollector.js';
import {
    CHAT_WEBHOOK_LEGACY_NAMES,
    CHAT_WEBHOOK_NAME,
    CONSOLE_AFFINITY_HEADROOM,
    CREATION_FAILURE_COOLDOWN_MS,
    getChatWebhookCreationOptions,
    IDLE_WEBHOOK_PRUNE_COOLDOWN_MS,
    MAX_WEBHOOKS_PER_CHANNEL,
    PRUNE_CHECK_INTERVAL_MS,
} from './ChatConstants.js';

const logger = rootLogger.child({ feature: features.api.socketio.chatHandlers.webhookPool });


export default class WebhookPoolManager {

    /**
     * Caches WebhookClient instances by webhook ID, reused across sends.
     * Clients are periodically refreshed to avoid stale-token send failures.
     * @type {Map<string, { client: Discord.WebhookClient, cachedAt: number }>}
     */
    webhookClients = new Map();

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

    /**
     * Tracks channels with pending deferred webhook creation timers to avoid duplicate attempts.
     * @type {Map<string, number>}
     */
    pendingCreations = new Map();

    /**
     * Cooldown timestamps for channels where webhook creation failed (permission denied, API error).
     * Prevents retrying the same channel on every incoming message.
     * @type {Map<string, number>}
     */
    failedCreations = new Map();

    /** @type {import('./ChatDispatchHandler.js').default} */
    dispatchHandler;

    /** @type {import('./ChatMonitor.js').default} */
    monitor;

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
            if(this.dispatchHandler.getQueueSize(channel.id) > this.dispatchHandler.batchThreshold) return true;
        }
        return false;
    }

    /**
     * Selects the best webhook for a chat channel.
     * For console messages, prefers the webhook that sent the last console message (edit affinity).
     * Periodically prunes idle excess webhooks.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @param {QueueItem['kind']} kind - The payload kind used for console affinity selection.
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

        if(kind === 'console') {
            // Prefer the webhook that sent the last console message (only it can edit),
            // but only while the message has enough headroom for more content.
            const lastMsg = this.lastConsoleMessages.get(channelConfig.id);
            if(lastMsg && webhooks.includes(lastMsg.webhookId)) {
                const charLimit = lastMsg.hasAnsi ? 1000 : 2000;
                if(lastMsg.raw.length < charLimit - CONSOLE_AFFINITY_HEADROOM) {
                    this.webhookLastActive.set(lastMsg.webhookId, now);
                    return lastMsg.webhookId;
                }
            }
        }

        this.webhookLastActive.set(webhooks[0], now);
        return webhooks[0];
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
        try {
            const discordChannel = await guild.channels.fetch(channelConfig.id).catch(() => null);
            if(!discordChannel) return null;

            const webhookChannel = discordChannel.isThread() ? discordChannel.parent : discordChannel;
            if(!webhookChannel) return null;

            const availableSlots = await this.getAvailableWebhookSlots(webhookChannel);
            if(availableSlots <= 0) return null;

            const webhookId = await this.createWebhook(channelConfig, server, guild, webhookChannel, webhookChannel);
            logger.debug({ guildId: guild.id }, `Scaled up webhook pool for channel ${channelConfig.id} (total=${channelConfig.webhooks.length})`);
            return webhookId;
        }
        catch(err) {
            if(err instanceof RateLimitError) {
                this.monitor?.recordRateLimit('scaleUp');
                logger.debug({ guildId: guild.id }, `Rate-limited scaling up webhook pool for channel ${channelConfig.id}`);
                return null;
            }
            throw err;
        }
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
     * Prunes idle webhooks from a channel's pool, keeping at least one webhook.
     * A webhook is considered idle if it hasn't been used within the prune cooldown period.
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
            if(now - lastActive > IDLE_WEBHOOK_PRUNE_COOLDOWN_MS)
                toRemove.push(webhookId);
        }

        if(toRemove.length === 0) return;

        const removed = [];
        for(const webhookId of toRemove) {
            try {
                await guild.client.deleteWebhook(webhookId);
                removed.push(webhookId);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    this.monitor?.recordRateLimit('deleteWebhook');
                    logger.debug({ guildId: guild.id }, `Rate-limited deleting idle webhook ${webhookId}, deferring prune`);
                    break;
                }
                if(err?.code === RESTJSONErrorCodes.UnknownWebhook || err?.code === RESTJSONErrorCodes.UnknownChannel) {
                    removed.push(webhookId);
                }
                else {
                    trackError('api_ws', 'WebhookPool', guild.id, null, err, null, logger);
                    break;
                }
            }
        }

        if(removed.length === 0) return;

        for(const webhookId of removed) {
            this.webhookLastActive.delete(webhookId);
            this.evictWebhookClient(webhookId);
        }

        channelConfig.webhooks = channelConfig.webhooks.filter(id => !removed.includes(id));

        const regChannel = await server.protocol.addChatChannel({
            id: channelConfig.id,
            webhook: channelConfig.webhooks[0],
            webhooks: channelConfig.webhooks,
            types: channelConfig.types,
            allowDiscordToMinecraft: channelConfig.allowDiscordToMinecraft,
        });

        if(regChannel) await server.edit({ chatChannels: regChannel.data });

        logger.debug({ guildId: guild.id }, `Pruned ${toRemove.length} idle webhook(s) for channel ${channelConfig.id} (remaining=${channelConfig.webhooks.length})`);
    }

    /**
     * Ensures at least one webhook exists for the given chat channel configuration, creating one if necessary.
     * If creation is rate-limited, schedules a deferred retry and returns null immediately.
     * @param {ChatChannelData} channel - The chat channel configuration to ensure a webhook for.
     * @param {ServerConnection} server - The server connection that owns this chat channel.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @returns {Promise<?string>} The first webhook ID, or null if it could not be ensured.
     */
    async ensureWebhookForChatChannel(channel, server, guild) {
        if(!channel.id) return null;
        if(channel.webhooks?.length > 0) return channel.webhooks[0];
        if(this.pendingCreations.has(channel.id)) return null;

        const failedUntil = this.failedCreations.get(channel.id);
        if(failedUntil && Date.now() < failedUntil) return null;
        this.failedCreations.delete(channel.id);

        const discordChannel = await guild.channels.fetch(channel.id)
            .catch(async err => {
                if(err instanceof RateLimitError) {
                    this.monitor?.recordRateLimit('channels.fetch');
                    return null;
                }
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) await this.removeChatChannel(server, channel);
                return null;
            });
        if(!discordChannel) return null;

        if(!discordChannel.permissionsFor) {
            trackError('api_ws', 'WebhookPool.ensureWebhook', guild.id, null, new Error(`permissionsFor not available on channel ${discordChannel.id} (type=${discordChannel.type})`), { channelId: discordChannel.id }, logger);
            return null;
        }
        const canManageWebhooks = discordChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageWebhooks);
        if(!canManageWebhooks) {
            this.monitor?.recordPermissionFailure();
            this.failedCreations.set(channel.id, Date.now() + CREATION_FAILURE_COOLDOWN_MS);
            await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission)] }).catch(() => {});
            return null;
        }

        const webhookChannel = discordChannel.isThread() ? discordChannel.parent : discordChannel;
        if(!webhookChannel) return null;

        try {
            return await this.createWebhook(channel, server, guild, webhookChannel, discordChannel);
        }
        catch(err) {
            if(err instanceof RateLimitError) {
                this.monitor?.recordRateLimit('createWebhook');
                this.scheduleWebhookCreation(channel, server, guild, err.retryAfter);
                return null;
            }
            throw err;
        }
    }

    /**
     * Schedules a deferred webhook creation attempt after a rate limit expires.
     * Prevents duplicate timers per channel.
     * @param {ChatChannelData} channel - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild.
     * @param {number} retryAfter - Milliseconds until the rate limit resets.
     */
    scheduleWebhookCreation(channel, server, guild, retryAfter) {
        if(this.pendingCreations.has(channel.id)) return;

        logger.debug({ guildId: guild.id }, `Scheduling deferred webhook creation for channel ${channel.id} in ${retryAfter}ms`);

        const timer = setTimeout(async () => {
            this.pendingCreations.delete(channel.id);
            try {
                await this.ensureWebhookForChatChannel(channel, server, guild);
            }
            catch(err) {
                logger.debug({ guildId: guild.id }, `Deferred webhook creation failed for channel ${channel.id}: ${err.message}`);
            }
        }, retryAfter + 1000);

        this.pendingCreations.set(channel.id, timer);
    }

    /**
     * Destroys and removes a cached WebhookClient for the given webhook ID.
     * @param {string} webhookId - The webhook ID to evict.
     */
    evictWebhookClient(webhookId) {
        const entry = this.webhookClients.get(webhookId);
        if(entry) {
            entry.client.destroy();
            this.webhookClients.delete(webhookId);
        }
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
            this.evictWebhookClient(webhookId);
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
            logger.debug({ guildId: guild.id }, `Created new webhook ${webhook.id} for channel ${channelConfig.id}`);
        }
        catch(err) {
            if(err instanceof RateLimitError) throw err;
            webhook = await this.findReusableChatWebhook(webhookChannel, guild.client.user.id);
            if(!webhook) {
                this.monitor?.recordCreationFailure();
                this.failedCreations.set(channelConfig.id, Date.now() + CREATION_FAILURE_COOLDOWN_MS);
                trackError('api_ws', 'WebhookPool', guild.id, null, err, null, logger);
                await errorChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_create_webhook)] }).catch(() => {});
                return null;
            }
        }

        if(!channelConfig.webhooks) channelConfig.webhooks = [];
        channelConfig.webhooks.push(webhook.id);
        this.webhookClients.set(webhook.id, {
            client: new Discord.WebhookClient(
                { id: webhook.id, token: webhook.token },
                { rest: { rejectOnRateLimit: () => true } },
            ), cachedAt: Date.now(),
        });

        const regChannel = await server.protocol.addChatChannel({
            id: channelConfig.id,
            webhook: channelConfig.webhooks[0],
            webhooks: channelConfig.webhooks,
            types: channelConfig.types,
            allowDiscordToMinecraft: channelConfig.allowDiscordToMinecraft,
        });

        if(!regChannel) {
            channelConfig.webhooks.pop();
            this.evictWebhookClient(webhook.id);
            await webhook.delete().catch(err => trackError('api_ws', 'WebhookPool.createWebhook', guild.id, null, err, {
                webhookId: webhook.id,
                reason: 'sync_cleanup',
            }, logger));
            await errorChannel.send({ embeds: [getEmbed(keys.api.plugin.warnings.could_not_sync_webhooks)] }).catch(err => trackError('api_ws', 'WebhookPool.createWebhook', guild.id, null, err, {
                channelId: errorChannel.id,
                reason: 'send_warning',
            }, logger));
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
