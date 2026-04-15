import Discord, { RateLimitError, RESTJSONErrorCodes } from 'discord.js';
import keys from '../../../utilities/keys.js';
import { getEmbed } from '../../../utilities/messages.js';
import {
    CODE_BLOCK_OVERHEAD_ANSI,
    CODE_BLOCK_OVERHEAD_PLAIN,
    containsAnsiCodes,
    MaxEmbedDescriptionLength,
    toAnsiCodeBlock,
} from '../../../utilities/utils.js';
import rootLogger from '../../../utilities/logger/Logger.js';
import features from '../../../utilities/logger/features.js';
import { trackError } from '../../../structures/analytics/AnalyticsCollector.js';
import { buildChatBatchPayload, buildChatPayload, getSystemWebhookSendOptions } from './ChatPayloadBuilder.js';

const logger = rootLogger.child({ feature: features.api.socketio.chatHandlers.queueProcessor });

/**
 * @typedef {Object} ChatQueueItem
 * @property {'chat'} kind
 * @property {string} serverId
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} player
 * @property {?string} authorURL
 * @property {string} message
 */

/**
 * @typedef {Object} ConsoleQueueItem
 * @property {'console'} kind
 * @property {string} serverId
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} raw
 */

/**
 * @typedef {Object} EmbedQueueItem
 * @property {'embed'} kind
 * @property {string} serverId
 * @property {string} guildId
 * @property {string} channelId
 * @property {Discord.EmbedBuilder} embed
 */

/**
 * @typedef {ChatQueueItem|ConsoleQueueItem|EmbedQueueItem} QueueItem
 */

export default class ChatQueueProcessor {

    /**
     * Tracks the latest console message per discord channel for append-by-edit behavior.
     * @type {Map<string, { id: string, raw: string, hasAnsi: boolean, webhookId: string }>}
     */
    lastConsoleMessages = new Map();

    /**
     * The MCLinker client instance, set lazily on the first execute call.
     * @type {?MCLinker}
     */
    client = null;

    /**
     * @param {Object} options
     * @param {WebhookResolver} options.resolver
     * @param {WebhookPoolManager} options.poolManager
     * @param {import('./ChatMonitor.js').default} options.monitor
     */
    constructor({ resolver, poolManager, monitor }) {
        this.resolver = resolver;
        this.poolManager = poolManager;
        this.monitor = monitor;
    }

    /**
     * @typedef {Object} ResolvedChannelContext
     * @property {ServerConnection} server
     * @property {Discord.Guild} guild
     * @property {ChatChannelData} chatChannel
     * @property {Discord.TextChannel} discordChannel
     */

    /**
     * Resolves the channel context needed to process a queue: server, guild, channel config, and discord channel.
     * Returns null (and clears the queue) if any resolution step fails.
     * @param {QueueItem} firstItem - The first item in the queue, used to extract IDs.
     * @returns {Promise<?ResolvedChannelContext>}
     */
    async resolveChannelContext(firstItem) {
        const { serverId, guildId, channelId } = firstItem;
        const server = this.client.serverConnections.cache.get(serverId);
        if(!server) return null;

        const guild = await this.monitor.track('guilds.fetch', () => this.client.guilds.fetch(guildId).catch(() => null));
        if(!guild) return null;

        const chatChannel = server.chatChannels.find(c => c.id === channelId);
        if(!chatChannel || !chatChannel.id) return null;

        const discordChannel = await this.monitor.track('channels.fetch', () =>
            guild.channels.fetch(channelId)
                .catch(async err => {
                    if(err?.code === RESTJSONErrorCodes.UnknownChannel) await this.poolManager.removeChatChannel(server, chatChannel);
                    return null;
                }),
        );
        if(!discordChannel) return null;

        return { server, guild, chatChannel, discordChannel };
    }

    /**
     * Dispatches items to the appropriate kind-specific queue processor.
     * @param {QueueItem['kind']} kind - The payload kind.
     * @param {Discord.TextChannel} discordChannel - The Discord channel to send to.
     * @param {Discord.WebhookClient|Discord.Webhook} webhook - The webhook to send messages with.
     * @param {QueueItem[]} items - The queued items to process.
     * @param {boolean} batchMode - Whether batch mode is active.
     * @returns {Promise<import('./ChatDispatchHandler.js').ProcessResult>}
     */
    _dispatchToProcessor(kind, discordChannel, webhook, items, batchMode) {
        if(kind === 'chat') return this.processChatQueue(discordChannel, webhook, items, batchMode);
        if(kind === 'console') return this.processConsoleQueue(discordChannel, webhook, items);
        return this.processEmbedQueue(discordChannel, webhook, items);
    }

    /**
     * Handles webhook send errors common to all queue processors.
     * Evicts dead webhooks, attempts recovery, and removes unknown channels.
     * @param {Error} err - The error thrown by the webhook send.
     * @param {QueueItem[]} items - The full queue (used for consumed count on fatal errors).
     * @param {string} webhookId - The webhook ID that failed.
     * @param {ChatChannelData} chatChannel - The chat channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {import('discord.js').Guild} guild - The guild.
     * @param {string} logContext - Label for error logging (e.g. 'chat' or 'channel').
     * @returns {Promise<import('./ChatDispatchHandler.js').ProcessResult>}
     */
    async handleWebhookSendError(err, items, webhookId, chatChannel, server, guild, logContext) {
        if(err?.code === RESTJSONErrorCodes.UnknownWebhook || err?.code === RESTJSONErrorCodes.InvalidWebhookToken) {
            this.poolManager.evictWebhookClient(webhookId);
            chatChannel.webhooks = chatChannel.webhooks.filter(id => id !== webhookId);
            this.poolManager.webhookLastActive.delete(webhookId);
            const newId = await this.poolManager.ensureWebhookForChatChannel(chatChannel, server, guild);
            if(newId) {
                await server.edit({});
                return { consumed: 0, retryMs: 100 };
            }
            return { consumed: items.length };
        }

        if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
            await this.poolManager.removeChatChannel(server, chatChannel);
            return { consumed: items.length };
        }

        trackError('api_ws', 'ChatQueue', guild.id, null, err, { kind: logContext }, logger);
        return { consumed: 1 };
    }

    /**
     * Callback invoked by the dispatch handler to process a batch of queued items.
     * Selects a preferred webhook, attempts to send, and falls back to alternative webhooks
     * in the pool if Discord rejects with a rate limit. Scales up the pool as a last resort.
     * @param {Object} params - The parameters from the dispatch handler.
     * @param {QueueItem[]} params.items - The queued items to process.
     * @param {boolean} params.batchMode - Whether batch mode is active for this destination.
     * @returns {Promise<import('./ChatDispatchHandler.js').ProcessResult>}
     */
    async processDispatchQueue({ items, batchMode }) {
        const firstItem = items[0];
        if(!firstItem) return { consumed: 0 };

        const ctx = await this.resolveChannelContext(firstItem);
        if(!ctx) return { consumed: items.length };

        const { chatChannel, server, guild, discordChannel } = ctx;
        const kind = firstItem.kind;

        // Build ordered candidate list: preferred webhook first, then alternatives
        const preferredId = await this.monitor.track('selectWebhook', () => this.poolManager.selectWebhook(chatChannel, server, guild, kind));
        if(!preferredId) return { consumed: items.length };

        const candidates = [preferredId, ...(chatChannel.webhooks ?? []).filter(id => id !== preferredId)];
        let bestRetryMs = null;

        for(const webhookId of candidates) {
            const webhook = await this.monitor.track('resolve', () => this.resolver.resolve(this.client, guild, server, chatChannel, webhookId));
            if(!webhook) continue;

            try {
                logger.debug({ guildId: guild.id }, `Processing dispatch queue (kind=${kind}, items=${items.length}, batchMode=${batchMode}, webhook=${webhookId})`);
                const result = await this._dispatchToProcessor(kind, discordChannel, webhook, items, batchMode);
                this.monitor.recordProcessed(result.consumed);
                return result;
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    this.monitor.recordRateLimit('webhook.send');
                    const retryMs = err.retryAfter ?? 1000;
                    bestRetryMs = bestRetryMs === null ? retryMs : Math.min(bestRetryMs, retryMs);
                    logger.debug({ guildId: guild.id }, `Webhook ${webhookId} rate-limited for channel ${chatChannel.id}; retry in ${retryMs}ms`);
                    continue;
                }
                return this.handleWebhookSendError(err, items, webhookId, chatChannel, server, guild, kind);
            }
        }

        // All webhooks rate-limited — try scaling up
        const newId = await this.monitor.track('tryScaleUp', () => this.poolManager.tryScaleUp(chatChannel, server, guild));
        if(newId) {
            const webhook = await this.monitor.track('resolve', () => this.resolver.resolve(this.client, guild, server, chatChannel, newId));
            if(webhook) {
                try {
                    logger.debug({ guildId: guild.id }, `Processing dispatch queue with scaled-up webhook (kind=${kind}, items=${items.length}, webhook=${newId})`);
                    const result = await this._dispatchToProcessor(kind, discordChannel, webhook, items, batchMode);
                    this.monitor.recordProcessed(result.consumed);
                    return result;
                }
                catch(err) {
                    if(err instanceof RateLimitError) {
                        this.monitor.recordRateLimit('webhook.send');
                        bestRetryMs = Math.min(bestRetryMs ?? Infinity, err.retryAfter ?? 1000);
                    }
                    else {
                        return this.handleWebhookSendError(err, items, newId, chatChannel, server, guild, kind);
                    }
                }
            }
        }

        logger.debug({ guildId: guild.id }, `All webhooks rate-limited for channel ${chatChannel.id}; retry in ${bestRetryMs}ms (items=${items.length}, batchMode=${batchMode})`);
        return { consumed: 0, retryMs: bestRetryMs ?? 1000 };
    }

    /**
     * Emits a skipped-message summary for a queue in high-load drop mode.
     * @param {{ item: QueueItem, skippedCount: number }} params
     * @returns {Promise<void>}
     */
    async handleHighLoadSkipped({ item, skippedCount }) {
        if(!item || skippedCount <= 0) return;

        const ctx = await this.resolveChannelContext(item);
        if(!ctx) return;

        try {
            // High load skip messages are sent by bot itself
            await ctx.discordChannel.send({
                embeds: [getEmbed(keys.api.plugin.warnings.high_load_skipped, { count: skippedCount })],
            });
        }
        catch(err) {
            trackError('api_ws', 'ChatQueue', item.guildId, null, err, null, logger);
        }
    }

    /**
     * Processes queued chat messages for a single channel destination.
     * In normal mode, combines consecutive messages from the same player into one webhook send.
     * In batch mode, combines all messages into a compact markdown format with a static webhook identity.
     * @param {Discord.TextChannel} discordChannel - The Discord channel to send to.
     * @param {Discord.WebhookClient|Discord.Webhook} webhook - The webhook to send messages with.
     * @param {ChatQueueItem[]} items - The queued chat items to process.
     * @param {boolean} batchMode - Whether batch mode is active.
     * @returns {Promise<import('./ChatDispatchHandler.js').ProcessResult>}
     */
    async processChatQueue(discordChannel, webhook, items, batchMode) {
        const { channelId } = items[0];

        if(batchMode || items.length > 5) {
            const payload = buildChatBatchPayload(items);
            if(payload.consumed <= 0) return { consumed: 1 };

            logger.debug({ guildId: discordChannel.guildId }, `Sending batched chat payload to channel ${channelId} (consumed=${payload.consumed}, length=${payload.content.length})`);
            await this.monitor.track('webhook.send', () => webhook.send({
                content: payload.content,
                ...getSystemWebhookSendOptions(discordChannel),
                allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
            }));

            return { consumed: payload.consumed, batchMode: items.length - payload.consumed > 2 };
        }
        else {
            const payload = buildChatPayload(items);
            if(payload.consumed <= 0) return { consumed: 1 };

            logger.debug({ guildId: discordChannel.guildId }, `Sending chat payload to channel ${channelId} (consumed=${payload.consumed}, length=${payload.content.length})`);
            await this.monitor.track('webhook.send', () => webhook.send({
                content: payload.content,
                username: payload.username,
                avatarURL: payload.avatarURL,
                ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
                allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
            }));

            return { consumed: payload.consumed, batchMode: false };
        }
    }

    /**
     * Processes queued embed events for a single channel destination.
     * Concatenates up to 10 embeds into a single webhook message.
     * @param {Discord.TextChannel} discordChannel - The Discord channel to send to.
     * @param {Discord.WebhookClient|Discord.Webhook} webhook - The webhook to send messages with.
     * @param {EmbedQueueItem[]} items - The queued embed items to process.
     * @returns {Promise<import('./ChatDispatchHandler.js').ProcessResult>}
     */
    async processEmbedQueue(discordChannel, webhook, items) {
        const { channelId } = items[0];

        const embeds = [];
        let consumed = 0;
        for(const item of items) {
            if(item.kind !== 'embed') break;
            if(embeds.length >= 10) break;
            embeds.push(item.embed);
            consumed++;
        }

        if(consumed <= 0) return { consumed: 1 };

        logger.debug({ guildId: discordChannel.guildId }, `Sending embed payload to channel ${channelId} (consumed=${consumed}, embeds=${embeds.length})`);
        await this.monitor.track('webhook.send', () => webhook.send({
            embeds,
            ...getSystemWebhookSendOptions(discordChannel),
        }));
        return { consumed };
    }

    /**
     * Processes queued console output for a single channel.
     * Combines consecutive console items and attempts to append to the last console message via edit.
     * Falls back to sending a new message if appending would exceed the character limit.
     * The limit is ~1000 chars when ANSI codes are present (Discord stops rendering them beyond that), or ~2000 otherwise.
     * @param {Discord.TextChannel} discordChannel - The Discord channel to send to.
     * @param {Discord.WebhookClient|Discord.Webhook} webhook - The webhook to send messages with.
     * @param {ConsoleQueueItem[]} items - The queued console items to process.
     * @returns {Promise<import('./ChatDispatchHandler.js').ProcessResult>}
     */
    async processConsoleQueue(discordChannel, webhook, items) {
        let consumed = 0;
        let combinedRaw = '';
        let hasAnsi = false;

        for(const item of items) {
            if(item.kind !== 'console') break;

            // newlines included
            const candidate = `${combinedRaw}${item.raw}`;
            const candidateHasAnsi = hasAnsi || containsAnsiCodes(item.raw);
            const charLimit = this.consoleCharLimit(candidateHasAnsi);
            if(candidate.length > charLimit && consumed > 0) break;

            combinedRaw = candidate;
            hasAnsi = candidateHasAnsi;
            consumed++;
        }

        if(consumed <= 0) return { consumed: 1 };

        const lastMessage = this.lastConsoleMessages.get(discordChannel.id);
        const appendHasAnsi = hasAnsi || (lastMessage?.hasAnsi ?? false);
        const appendCharLimit = this.consoleCharLimit(appendHasAnsi);
        if(lastMessage && lastMessage.raw.length + combinedRaw.length <= appendCharLimit) {
            try {
                const nextRaw = `${lastMessage.raw}${combinedRaw}`;
                logger.debug({ guildId: discordChannel.guildId }, `Appending console payload to previous message in channel ${discordChannel.id} (consumed=${consumed}, addedLength=${combinedRaw.length})`);
                await this.monitor.track('webhook.editMessage', () => webhook.editMessage(lastMessage.id, {
                    content: toAnsiCodeBlock(nextRaw),
                    ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
                }));
                this.lastConsoleMessages.set(discordChannel.id, {
                    id: lastMessage.id,
                    raw: nextRaw,
                    hasAnsi: appendHasAnsi,
                    webhookId: webhook.id,
                });
                return { consumed };
            }
            catch(err) {
                if(err instanceof RateLimitError) throw err;

                if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
                    const server = discordChannel.client.serverConnections.cache.get(discordChannel.guildId);
                    const chatChannel = server?.chatChannels.find(c => c.id === discordChannel.id);
                    if(chatChannel) await this.poolManager.removeChatChannel(server, chatChannel);
                    return { consumed: items.length };
                }

                if(err?.code === RESTJSONErrorCodes.UnknownWebhook || err?.code === RESTJSONErrorCodes.InvalidWebhookToken) throw err;
                // Previous console message no longer editable/deleted; reset and send a fresh message below.
                this.lastConsoleMessages.delete(discordChannel.id);
                logger.debug({ guildId: discordChannel.guildId }, `Falling back to fresh console webhook send for channel ${discordChannel.id}: ${err?.message ?? 'unknown error'}`);
            }
        }

        logger.debug({ guildId: discordChannel.guildId }, `Sending new console payload to channel ${discordChannel.id} (consumed=${consumed}, length=${combinedRaw.length})`);
        let sentMessage = await this.monitor.track('webhook.send', () => webhook.send({
            content: toAnsiCodeBlock(combinedRaw),
            ...getSystemWebhookSendOptions(discordChannel),
        }));

        this.lastConsoleMessages.set(discordChannel.id, {
            id: sentMessage.id,
            raw: combinedRaw,
            hasAnsi,
            webhookId: webhook.id,
        });

        return { consumed };
    }

    /**
     * Calculates the character limit for console output, adjusting for ANSI escape codes if present.
     * @param hasAnsi hasAnsi ? 1000 - 12 : 2000 - 8; // 8 chars for ``` + surrounding newlines, 12 chars for ```ansi + surrounding newlines
     * @return {number} - The maximum character limit for the console output based on the presence of ANSI codes.
     */
    consoleCharLimit(hasAnsi) {
        // Ansi codes are not parsed over 1000 chars by Discord
        return hasAnsi ? 1000 - CODE_BLOCK_OVERHEAD_ANSI : MaxEmbedDescriptionLength - CODE_BLOCK_OVERHEAD_PLAIN; // 8 for code block, 12 for code block + 'ansi'
    }
}
