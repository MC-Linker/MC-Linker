import Discord, { PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import WSEvent from '../WSEvent.js';
import keys from '../../utilities/keys.js';
import {
    containsAnsiCodes,
    getMinecraftAvatarURL,
    searchAdvancements,
    toAnsiCodeBlock,
} from '../../utilities/utils.js';
import { addPh, getEmbed } from '../../utilities/messages.js';
import logger from '../../utilities/logger.js';
import ChatDispatchHandler from './handlers/ChatDispatchHandler.js';

const CHAT_WEBHOOK_NAME = 'MC Linker Chat';
const CHAT_WEBHOOK_AVATAR_URL = 'https://mclinker.com/logo.png';
const CHAT_WEBHOOK_LEGACY_NAMES = new Set(['MC Linker', 'ChatChannel']);
const DISPATCH_HIGH_LOAD_ENTER_THRESHOLD = 120;
const DISPATCH_HIGH_LOAD_EXIT_THRESHOLD = 60;
const DISPATCH_HIGH_LOAD_SUMMARY_INTERVAL_MS = 10_000;
const MAX_WEBHOOKS_PER_CHANNEL = 15;
const IDLE_WEBHOOK_PRUNE_COOLDOWN_MS = 60_000;
const PRUNE_CHECK_INTERVAL_MS = 30_000;

/**
 * Returns the default webhook identity used for chat-channel webhook messages.
 * @returns {import('discord.js').WebhookMessageCreateOptions['username'|'avatarURL']}
 */
export function getChatWebhookIdentity() {
    return {
        username: CHAT_WEBHOOK_NAME,
        avatarURL: CHAT_WEBHOOK_AVATAR_URL,
    };
}

/**
 * Returns the default webhook creation options for chat channels.
 * @returns {import('discord.js').ChannelWebhookCreateOptions}
 */
export function getChatWebhookCreationOptions() {
    return {
        name: CHAT_WEBHOOK_NAME,
        reason: 'ChatChannel to Minecraft',
        avatar: CHAT_WEBHOOK_AVATAR_URL,
    };
}


export default class Chat extends WSEvent {

    /**
     * Tracks the latest console message per discord channel for append-by-edit behavior.
     * @type {Map<string, { id: string, raw: string, hasAnsi: boolean }>}
     */
    lastConsoleMessages = new Map();

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
     * @typedef {Object} ChatRequest
     * @property {'chat'|'console'|'join'|'quit'|'death'|'advancement'|'player_command'|'console_command'|'block_command'|'start'|'close'} type
     * @property {string} message
     * @property {string} [player] - Required for type 'chat', 'join', 'quit', 'death', 'advancement', 'player_command'
     */

    /**
     * @typedef {Object} ChatQueueItem
     * @property {'chat'} kind
     * @property {MCLinker} client
     * @property {string} serverId
     * @property {string} guildId
     * @property {string} channelId
     * @property {string} webhookId
     * @property {string} player
     * @property {?string} authorURL
     * @property {string} message
     */

    /**
     * @typedef {Object} ConsoleQueueItem
     * @property {'console'} kind
     * @property {MCLinker} client
     * @property {string} serverId
     * @property {string} guildId
     * @property {string} channelId
     * @property {string} webhookId
     * @property {string} raw
     */

    /**
     * @typedef {Object} EmbedQueueItem
     * @property {'embed'} kind
     * @property {MCLinker} client
     * @property {string} serverId
     * @property {string} guildId
     * @property {string} channelId
     * @property {string} webhookId
     * @property {Discord.EmbedBuilder} embed
     */

    /**
     * @typedef {ChatQueueItem|ConsoleQueueItem|EmbedQueueItem} QueueItem
     */

    /** @type {ChatDispatchHandler} */
    dispatchHandler;

    constructor() {
        super({
            event: 'chat',
        });

        this.dispatchHandler = new ChatDispatchHandler({
            batchThreshold: 5,
            points: 5,
            duration: 2,
            highLoadEnterThreshold: DISPATCH_HIGH_LOAD_ENTER_THRESHOLD,
            highLoadExitThreshold: DISPATCH_HIGH_LOAD_EXIT_THRESHOLD,
            highLoadSummaryIntervalMs: DISPATCH_HIGH_LOAD_SUMMARY_INTERVAL_MS,
            onProcess: this.processDispatchQueue.bind(this),
            onHighLoadSkipped: this.handleHighLoadSkipped.bind(this),
        });
    }

    /**
     * Handles chat channel messages.
     * @param {ChatRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async execute(data, server, client) {
        const { type, player } = data;
        let message = data.message ?? '';

        const channels = server.chatChannels.filter(c => c.types.includes(type));
        if(channels.length === 0) return; //No channels to send to

        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type) && server.settings.isFilteredCommand(message)) return;

        const guildId = server.id;
        // TODO - this is expensive, cache or disable in batch mode
        const authorURL = player ? await getMinecraftAvatarURL(player) : null;

        const placeholders = { username: player, author_url: authorURL, message };

        //Add special placeholders for advancements
        if(type === 'advancement') {
            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = searchAdvancements(id, category, false, true, 1)[0];

            if(!advancement) return; // Advancement not found

            const advancementTitle = advancement?.name ?? message;
            const advancementDesc = advancement?.description ?? keys.commands.advancements.no_description_available;

            // Add placeholder to argPlaceholder so it can be used later
            placeholders.advancement_title = advancementTitle;
            placeholders.advancement_description = advancementDesc;
        }
        else if(type === 'death' && (!message || message === '')) placeholders.message = addPh(keys.api.plugin.success.default_death_message, placeholders);

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if(!guild) return;

        if(type === 'chat') {
            if(!message) return;

            placeholders.message = await this.parseMentions(placeholders.message, guild);

            for(const channel of channels) {
                const webhookId = await this.selectWebhook(channel, server, guild);
                if(!webhookId) continue;

                logger.debug(`[Socket.io][Chat] Enqueue chat message for channel ${channel.id} via webhook ${webhookId}`);

                this.dispatchHandler.enqueue(webhookId, 'chat', {
                    kind: 'chat',
                    client,
                    serverId: server.id,
                    guildId,
                    channelId: channel.id,
                    webhookId,
                    player,
                    authorURL,
                    message: placeholders.message,
                });
            }
        }
        else if(type === 'console') {
            if(!message) return;

            for(const channel of channels) {
                const webhookId = await this.selectWebhook(channel, server, guild);
                if(!webhookId) continue;

                logger.debug(`[Socket.io][Chat] Enqueue console payload for channel ${channel.id} via webhook ${webhookId}`);

                this.dispatchHandler.enqueue(webhookId, 'channel', {
                    kind: 'console',
                    client,
                    serverId: server.id,
                    guildId,
                    channelId: channel.id,
                    webhookId,
                    raw: message,
                });
            }
        }
        else {
            const chatEmbed = getEmbed(keys.api.plugin.success.messages[type], placeholders, { 'timestamp_now': Date.now() });

            for(const channel of channels) {
                const webhookId = await this.selectWebhook(channel, server, guild);
                if(!webhookId) continue;

                logger.debug(`[Socket.io][Chat] Enqueue ${type} embed for channel ${channel.id} via webhook ${webhookId}`);

                this.dispatchHandler.enqueue(webhookId, 'channel', {
                    kind: 'embed',
                    client,
                    serverId: server.id,
                    guildId,
                    channelId: channel.id,
                    webhookId,
                    embed: chatEmbed,
                });
            }
        }
    }

    /**
     * Callback invoked by the dispatch handler to process a batch of queued items.
     * Routes to the appropriate processor based on the bucket type.
     * @param {Object} params - The parameters from the dispatch handler.
     * @param {import('./handlers/ChatDispatchHandler.js').QueueBucket} params.bucket - The bucket type ('chat' or 'channel').
     * @param {QueueItem[]} params.items - The queued items to process.
     * @param {boolean} params.batchMode - Whether batch mode is active for this destination.
     * @returns {Promise<import('./handlers/ChatDispatchHandler.js').ProcessResult>}
     */
    async processDispatchQueue({ bucket, items, batchMode }) {
        logger.debug(`[Socket.io][Chat] Processing dispatch queue for bucket ${bucket} (items=${items.length}, batchMode=${batchMode})`);
        if(bucket === 'chat') return this.processChatQueue(items, batchMode);
        return this.processChannelQueue(items);
    }

    /**
     * Emits a skipped-message summary for a queue in high-load drop mode.
     * @param {{ item: QueueItem, skippedCount: number }} params
     * @returns {Promise<void>}
     */
    async handleHighLoadSkipped({ item, skippedCount }) {
        if(!item || skippedCount <= 0) return;

        const { client, serverId, guildId, channelId, webhookId } = item;
        const server = client.serverConnections.cache.get(serverId);
        if(!server) return;

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if(!guild) return;

        const chatChannel = server.chatChannels.find(c => c.id === channelId);
        if(!chatChannel) return;

        const discordChannel = await guild.channels.fetch(channelId)
            .catch(async err => {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) await this.removeChatChannel(server, chatChannel);
                return null;
            });
        if(!discordChannel) return;

        const webhook = await this.resolveWebhook(client, guild, server, chatChannel, webhookId);
        if(!webhook) return;

        await webhook.send({
            embeds: [getEmbed(keys.api.plugin.warnings.high_load_skipped, { count: skippedCount })],
            ...this.getSystemWebhookSendOptions(discordChannel),
        });
    }

    /**
     * Processes queued chat messages for a single webhook destination.
     * In normal mode, combines consecutive messages from the same player into one webhook send.
     * In batch mode, combines all messages into a compact markdown format with a static webhook identity.
     * @param {ChatQueueItem[]} items - The queued chat items to process.
     * @param {boolean} batchMode - Whether batch mode is active.
     * @returns {Promise<import('./handlers/ChatDispatchHandler.js').ProcessResult>}
     */
    async processChatQueue(items, batchMode) {
        const firstItem = items[0];
        if(!firstItem) return { consumed: 0 };

        const { client, serverId, guildId, channelId, webhookId } = firstItem;
        const server = client.serverConnections.cache.get(serverId);
        if(!server) return { consumed: items.length }; // Returning items.length clears queue

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if(!guild) return { consumed: items.length };

        const chatChannel = server.chatChannels.find(c => c.id === channelId);
        if(!chatChannel) return { consumed: items.length };

        const discordChannel = await guild.channels.fetch(channelId)
            .catch(async err => {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) await this.removeChatChannel(server, chatChannel);
                return null;
            });
        if(!discordChannel) return { consumed: items.length };

        let webhook = await this.resolveWebhook(guild.client, guild, server, chatChannel, webhookId);
        if(!webhook) return { consumed: items.length };

        const switchToBatch = batchMode || items.length > 5;

        try {
            if(switchToBatch) {
                const payload = this.buildChatBatchPayload(items);
                if(payload.consumed <= 0) return { consumed: 1 };

                logger.debug(`[Socket.io][Chat] Sending batched chat payload to channel ${channelId} (consumed=${payload.consumed}, length=${payload.content.length})`);

                await webhook.send({
                    content: payload.content,
                    ...this.getSystemWebhookSendOptions(discordChannel),
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });

                return { consumed: payload.consumed, batchMode: items.length - payload.consumed > 2 };
            }
            else {
                const payload = this.buildChatPayload(items);
                if(payload.consumed <= 0) return { consumed: 1 };

                logger.debug(`[Socket.io][Chat] Sending chat payload to channel ${channelId} (consumed=${payload.consumed}, length=${payload.content.length})`);

                await webhook.send({
                    content: payload.content,
                    username: payload.username,
                    avatarURL: payload.avatarURL,
                    ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });

                return { consumed: payload.consumed, batchMode: false };
            }
        }
        catch(err) {
            if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                chatChannel.webhooks = (chatChannel.webhooks ?? []).filter(id => id !== webhookId);
                this.webhookLastActive.delete(webhookId);
                const newId = await this.ensureWebhookForChatChannel(chatChannel, server, guild);
                if(newId) {
                    await server.edit({});
                    return { consumed: 0, retryMs: 100 };
                }
                return { consumed: items.length };
            }

            if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
                await this.removeChatChannel(server, chatChannel);
                return { consumed: items.length };
            }

            logger.error(err, `[Socket.io][Chat] Failed sending queued chat webhook payload for channel ${channelId}`);
            return { consumed: 1 };
        }
    }

    /**
     * Processes queued channel messages (console output or embed events) for a single channel destination.
     * Concatenates up to 10 embeds into a single message, or delegates to the console processor.
     * @param {(ConsoleQueueItem|EmbedQueueItem)[]} items - The queued channel items to process.
     * @returns {Promise<import('./handlers/ChatDispatchHandler.js').ProcessResult>}
     */
    async processChannelQueue(items) {
        const firstItem = items[0];
        if(!firstItem) return { consumed: 0 };

        const { client, serverId, guildId, channelId, webhookId } = firstItem;
        const server = client.serverConnections.cache.get(serverId);
        if(!server) return { consumed: items.length };

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if(!guild) return { consumed: items.length };

        const chatChannel = server.chatChannels.find(c => c.id === channelId);
        if(!chatChannel) return { consumed: items.length };

        const discordChannel = await guild.channels.fetch(channelId)
            .catch(async err => {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
                    if(chatChannel) await this.removeChatChannel(server, chatChannel);
                }
                return null;
            });
        if(!discordChannel) return { consumed: items.length };

        const webhook = await this.resolveWebhook(client, guild, server, chatChannel, webhookId);
        if(!webhook) return { consumed: items.length };

        try {
            if(firstItem.kind === 'console') return this.processConsoleQueue(webhook, discordChannel, items);

            const embeds = [];
            let consumed = 0;
            for(const item of items) {
                if(item.kind !== 'embed') break;
                if(embeds.length >= 10) break;
                embeds.push(item.embed);
                consumed++;
            }

            if(consumed <= 0) return { consumed: 1 };

            logger.debug(`[Socket.io][Chat] Sending embed payload to channel ${channelId} (embeds=${embeds.length}, consumed=${consumed})`);

            await webhook.send({
                embeds,
                ...this.getSystemWebhookSendOptions(discordChannel),
            });
            return { consumed };
        }
        catch(err) {
            if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                chatChannel.webhooks = (chatChannel.webhooks ?? []).filter(id => id !== webhookId);
                this.webhookLastActive.delete(webhookId);
                const newId = await this.ensureWebhookForChatChannel(chatChannel, server, guild);
                if(newId) {
                    await server.edit({});
                    return { consumed: 0, retryMs: 100 };
                }
                return { consumed: items.length };
            }

            if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
                if(chatChannel) await this.removeChatChannel(server, chatChannel);
                return { consumed: items.length };
            }

            logger.error(err, `[Socket.io][Chat] Failed sending queued channel payload for channel ${channelId}`);
            return { consumed: 1 };
        }
    }

    /**
     * Processes queued console output for a single channel.
     * Combines consecutive console items and attempts to append to the last console message via edit.
     * Falls back to sending a new message if appending would exceed the character limit.
     * The limit is ~1000 chars when ANSI codes are present (Discord stops rendering them beyond that), or ~2000 otherwise.
     * @param {Discord.Webhook} webhook - The webhook to send messages with.
     * @param {Discord.TextChannel} discordChannel - The Discord channel to send to.
     * @param {ConsoleQueueItem[]} items - The queued console items to process.
     * @returns {Promise<import('./handlers/ChatDispatchHandler.js').ProcessResult>}
     */
    async processConsoleQueue(webhook, discordChannel, items) {
        let consumed = 0;
        let combinedRaw = '';
        let hasAnsi = false;

        for(const item of items) {
            if(item.kind !== 'console') break;

            // newlines included
            const candidate = `${combinedRaw}${item.raw}`;
            const candidateHasAnsi = hasAnsi || containsAnsiCodes(item.raw);
            const charLimit = candidateHasAnsi ? 1000 : 2000;
            if(candidate.length > charLimit && consumed > 0) break;

            combinedRaw = candidate;
            hasAnsi = candidateHasAnsi;
            consumed++;
        }

        if(consumed <= 0) return { consumed: 1 };

        const webhookSendOptions = this.getSystemWebhookSendOptions(discordChannel);

        const lastMessage = this.lastConsoleMessages.get(discordChannel.id);
        const appendHasAnsi = hasAnsi || (lastMessage?.hasAnsi ?? false);
        const appendCharLimit = appendHasAnsi ? 1000 : 2000;
        if(lastMessage && lastMessage.raw.length + combinedRaw.length <= appendCharLimit) {
            try {
                const nextRaw = `${lastMessage.raw}${combinedRaw}`;
                logger.debug(`[Socket.io][Chat] Appending console payload to previous message in channel ${discordChannel.id} (consumed=${consumed}, addedLength=${combinedRaw.length})`);
                await webhook.editMessage(lastMessage.id, {
                    content: toAnsiCodeBlock(nextRaw),
                    ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
                });
                this.lastConsoleMessages.set(discordChannel.id, {
                    id: lastMessage.id,
                    raw: nextRaw,
                    hasAnsi: appendHasAnsi,
                });
                return { consumed };
            }
            catch(err) {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
                    const server = discordChannel.client.serverConnections.cache.get(discordChannel.guildId);
                    const chatChannel = server?.chatChannels.find(c => c.id === discordChannel.id);
                    if(chatChannel) await this.removeChatChannel(server, chatChannel);
                    return { consumed: items.length };
                }

                if(err?.code === RESTJSONErrorCodes.UnknownWebhook) throw err;
                // Previous console message no longer editable/deleted; reset and send a fresh message below.
                this.lastConsoleMessages.delete(discordChannel.id);
                logger.debug(`[Socket.io][Chat] Falling back to fresh console webhook send for channel ${discordChannel.id}: ${err?.code ?? err?.message ?? 'unknown error'}`);
            }
        }

        logger.debug(`[Socket.io][Chat] Sending new console payload to channel ${discordChannel.id} (consumed=${consumed}, length=${combinedRaw.length})`);
        const sentMessage = await webhook.send({ content: toAnsiCodeBlock(combinedRaw), ...webhookSendOptions });
        this.lastConsoleMessages.set(discordChannel.id, {
            id: sentMessage.id,
            raw: combinedRaw,
            hasAnsi,
        });

        return { consumed };
    }

    /**
     * Returns options used for system-style webhook messages in chat channels.
     * @param {Discord.TextChannel} discordChannel - The destination channel.
     * @returns {{ username: string, avatarURL: string, threadId?: string }}
     */
    getSystemWebhookSendOptions(discordChannel) {
        return {
            ...getChatWebhookIdentity(),
            ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
        };
    }

    /**
     * Builds a webhook payload for chat messages, combining consecutive messages from the same player
     * into one message with line breaks, up to Discord's 2000-character limit.
     * @param {ChatQueueItem[]} items - The queued chat items (only leading items from the same player are consumed).
     * @returns {{ consumed: number, content: string, username: string, avatarURL: ?string }}
     */
    buildChatPayload(items) {
        const first = items[0];
        const playerName = first.player || 'Minecraft';

        let consumed = 0;
        let content = '';
        for(const item of items) {
            if(item.kind !== 'chat') break;
            if((item.player || 'Minecraft') !== playerName) break;

            const nextLine = item.message || '';
            const nextContent = content ? `${content}\n${nextLine}` : nextLine;
            if(nextContent.length > 2000 && consumed > 0) break;

            // Single message over 2000
            content = nextContent.length > 2000 ? `${nextContent.slice(0, 1999)}…` : nextContent;
            consumed++;
        }

        return {
            consumed,
            content,
            username: playerName,
            avatarURL: first.authorURL,
        };
    }

    /**
     * Builds a batch-mode payload for chat messages, formatting each as `**Player**: message` markdown.
     * Messages from different players are combined into a single content string up to Discord's 2000-character limit.
     * @param {ChatQueueItem[]} items - The queued chat items to batch.
     * @returns {{ consumed: number, content: string }}
     */
    buildChatBatchPayload(items) {
        let consumed = 0;
        let content = '';

        for(const item of items) {
            if(item.kind !== 'chat') break;

            const name = item.player || 'Minecraft';
            // Make each message single-line
            const text = (item.message || '').replace(/\n+/g, ' ').trim();
            const line = `**${name}**: ${text}`;
            const nextContent = content ? `${content}\n${line}` : line;

            if(nextContent.length > 2000 && consumed > 0) break;

            // Single message over 2000
            content = nextContent.length > 2000 ? `${nextContent.slice(0, 1999)}…` : nextContent;
            consumed++;
        }

        return { consumed, content };
    }

    /**
     * Parses `@username` mentions in a message string and replaces them with Discord member mentions.
     * Only exact matches against display name, nickname, or username are replaced.
     * @param {string} message - The raw message text potentially containing `@username` mentions.
     * @param {Discord.Guild} guild - The guild to search for members in.
     * @returns {Promise<string>} The message with matched mentions replaced by Discord mention strings.
     */
    async parseMentions(message, guild) {
        let parsedMessage = message;
        const mentions = parsedMessage.match(/@(\S+)/g);
        for(const mention of mentions ?? []) {
            if(mention.length > 101) continue;

            const search = mention.replace('@', '').toLowerCase();
            //TODO api call - disable under high load
            const foundMember = (await guild.members.search({ query: search, limit: 1 }).catch(() => null))?.first();
            if(!foundMember) continue;

            // Only exact matches
            if(
                foundMember?.user.displayName.toLowerCase() !== search &&
                foundMember?.displayName.toLowerCase() !== search &&
                foundMember?.user.username.toLowerCase() !== search
            ) continue;

            parsedMessage = parsedMessage.replace(mention, foundMember.toString());
        }

        return parsedMessage;
    }

    /**
     * Selects the best webhook for a chat channel, distributing load across the webhook pool.
     * Creates additional webhooks when all existing ones are under pressure, up to the channel's available capacity.
     * Periodically prunes idle excess webhooks.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {Discord.Guild} guild - The guild the channel belongs to.
     * @returns {Promise<?string>} The selected webhook ID, or null if no webhook could be ensured.
     */
    async selectWebhook(channelConfig, server, guild) {
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
        if(webhooks.length <= 1) {
            this.webhookLastActive.set(firstId, now);
            return firstId;
        }

        // Find the least-loaded webhook by queue size
        let bestId = webhooks[0];
        let bestSize = this.dispatchHandler.getQueueSize(webhooks[0]);
        for(let i = 1; i < webhooks.length; i++) {
            const size = this.dispatchHandler.getQueueSize(webhooks[i]);
            if(size < bestSize) {
                bestId = webhooks[i];
                bestSize = size;
            }
        }

        // Scale up if all webhooks are under pressure
        if(bestSize > this.dispatchHandler.batchThreshold) {
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
     * @param {Discord.Guild} guild - The guild the channel belongs to.
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
     * @param {Discord.TextChannel} channel - The webhook-container channel (thread parent or text channel).
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
     * @param {Discord.Guild} guild - The guild the channel belongs to.
     * @param {Discord.TextChannel} [webhookChannel] - The channel to create the webhook in (resolved if not provided).
     * @returns {Promise<?string>} The new webhook ID, or null if creation failed.
     */
    async createAdditionalWebhook(channelConfig, server, guild, webhookChannel) {
        if(!webhookChannel) {
            const discordChannel = await guild.channels.fetch(channelConfig.id).catch(() => null);
            if(!discordChannel) return null;
            webhookChannel = discordChannel.isThread() ? discordChannel.parent : discordChannel;
            if(!webhookChannel) return null;
        }

        const canManageWebhooks = webhookChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageWebhooks);
        if(!canManageWebhooks) return null;

        let webhook;
        try {
            webhook = await webhookChannel.createWebhook(getChatWebhookCreationOptions());
        }
        catch(err) {
            logger.debug(`[Socket.io][Chat] Failed creating additional webhook for channel ${channelConfig.id}: ${err?.message}`);
            return null;
        }

        if(!channelConfig.webhooks) channelConfig.webhooks = [];
        channelConfig.webhooks.push(webhook.id);

        const regChannel = await server.protocol.addChatChannel({
            id: channelConfig.id,
            webhooks: channelConfig.webhooks,
            types: channelConfig.types,
            allowDiscordToMinecraft: channelConfig.allowDiscordToMinecraft,
        });

        if(!regChannel) {
            channelConfig.webhooks.pop();
            await webhook.delete().catch(() => {});
            return null;
        }

        await server.edit({ chatChannels: regChannel.data });
        logger.debug(`[Socket.io][Chat] Scaled up webhook pool for channel ${channelConfig.id} (total=${channelConfig.webhooks.length})`);
        return webhook.id;
    }

    /**
     * Prunes idle webhooks from a channel's pool, keeping at least one webhook.
     * A webhook is considered idle if it hasn't been used for enqueueing within the prune cooldown period
     * and its dispatch queue is empty.
     * @param {ChatChannelData} channelConfig - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {Discord.Guild} guild - The guild the channel belongs to.
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
            if(queueSize === 0 && now - lastActive > IDLE_WEBHOOK_PRUNE_COOLDOWN_MS) {
                toRemove.push(webhookId);
            }
        }

        if(toRemove.length === 0) return;

        for(const webhookId of toRemove) {
            try {
                await guild.client.deleteWebhook(webhookId);
            }
            catch(_) {}
            this.webhookLastActive.delete(webhookId);
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
     * Resolves a Discord Webhook object for the given webhook ID, falling back to other pool
     * members or creating a replacement if the requested webhook is dead.
     * @param {Discord.Client} client - The Discord client used to fetch webhooks.
     * @param {Discord.Guild} guild - The guild the channel belongs to.
     * @param {ServerConnection} server - The server connection.
     * @param {ChatChannelData} channelConfig - The chat channel configuration object.
     * @param {string} webhookId - The webhook ID to resolve.
     * @returns {Promise<?Discord.Webhook>} The resolved webhook, or null if it could not be resolved or created.
     */
    async resolveWebhook(client, guild, server, channelConfig, webhookId) {
        if(!webhookId) {
            webhookId = await this.ensureWebhookForChatChannel(channelConfig, server, guild);
            if(!webhookId) return null;
        }

        try {
            // TODO called every time - use WebhookClient instead and cache tokens
            return await client.fetchWebhook(webhookId);
        }
        catch(err) {
            if(err?.code !== RESTJSONErrorCodes.UnknownWebhook) {
                logger.error(err, `[Socket.io][Chat] Failed fetching webhook ${webhookId} for channel ${channelConfig.id}`);
                return null;
            }
        }

        // Webhook is dead — remove from pool and try alternatives
        channelConfig.webhooks = (channelConfig.webhooks ?? []).filter(id => id !== webhookId);
        this.webhookLastActive.delete(webhookId);

        // Try remaining pool webhooks
        for(const altId of [...(channelConfig.webhooks ?? [])]) {
            try {
                return await client.fetchWebhook(altId);
            }
            catch(err) {
                if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                    channelConfig.webhooks = channelConfig.webhooks.filter(id => id !== altId);
                    this.webhookLastActive.delete(altId);
                }
            }
        }

        // Pool exhausted, create new (ensureWebhookForChatChannel persists)
        const newId = await this.ensureWebhookForChatChannel(channelConfig, server, guild);
        if(!newId) return null;

        return await client.fetchWebhook(newId)
            .catch(err => {
                logger.error(err, `[Socket.io][Chat] Failed fetching replacement webhook ${newId} for channel ${channelConfig.id}`);
                return null;
            });
    }

    /**
     * Ensures at least one webhook exists for the given chat channel configuration, creating one if necessary.
     * @param {ChatChannelData} channel - The chat channel configuration to ensure a webhook for.
     * @param {ServerConnection} server - The server connection that owns this chat channel.
     * @param {Discord.Guild} guild - The guild the channel belongs to.
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

        let webhook;
        try {
            webhook = await webhookChannel.createWebhook(getChatWebhookCreationOptions());
        }
        catch(err) {
            webhook = await this.findReusableChatWebhook(webhookChannel, guild.client.user.id);
            if(!webhook) {
                logger.error(err, `[Socket.io][Chat] Failed creating webhook for channel ${channel.id}`);
                await discordChannel.send({ embeds: [getEmbed(keys.commands.chatchannel.errors.could_not_create_webhook)] }).catch(() => {});
                return null;
            }
        }

        if(!channel.webhooks) channel.webhooks = [];
        channel.webhooks.push(webhook.id);

        const regChannel = await server.protocol.addChatChannel({
            id: channel.id,
            webhooks: channel.webhooks,
            types: channel.types,
            allowDiscordToMinecraft: channel.allowDiscordToMinecraft,
        });

        if(!regChannel) {
            channel.webhooks.pop();
            await webhook.delete().catch(() => {});
            await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook)] }).catch(() => {});
            return null;
        }

        await server.edit({ chatChannels: regChannel.data });
        return webhook.id;
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
        }
        await server.edit({ chatChannels: regChannel.data });
    }

    /**
     * Attempts to find an existing bot-owned webhook in the channel that can be reused.
     * @param {Discord.TextChannel} channel - The webhook container channel (thread parent or text channel).
     * @param {string} botId - The current bot user id.
     * @returns {Promise<?Discord.Webhook>}
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
