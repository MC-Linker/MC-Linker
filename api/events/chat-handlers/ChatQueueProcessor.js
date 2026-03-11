import Discord, { RESTJSONErrorCodes } from 'discord.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import keys from '../../../utilities/keys.js';
import { getEmbed } from '../../../utilities/messages.js';
import { containsAnsiCodes, toAnsiCodeBlock } from '../../../utilities/utils.js';
import logger from '../../../utilities/logger.js';
import { buildChatBatchPayload, buildChatPayload, getSystemWebhookSendOptions } from './ChatPayloadBuilder.js';

/**
 * @typedef {Object} ChatQueueItem
 * @property {'chat'} kind
 * @property {MCLinker} client
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
 * @property {MCLinker} client
 * @property {string} serverId
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} raw
 */

/**
 * @typedef {Object} EmbedQueueItem
 * @property {'embed'} kind
 * @property {MCLinker} client
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
     * @param {Object} options
     * @param {WebhookResolver} options.resolver
     * @param {WebhookPoolManager} options.poolManager
     * @param {number} [options.points=5]
     * @param {number} [options.duration=2]
     */
    constructor({ resolver, poolManager, points, duration }) {
        this.resolver = resolver;
        this.poolManager = poolManager;

        /**
         * Per-webhook rate limiter applied at process time.
         * @type {RateLimiterMemory}
         */
        this.limiter = new RateLimiterMemory({
            keyPrefix: 'chat-process-webhook',
            points: points,
            duration: duration,
        });
    }

    /**
     * @typedef {Object} ResolvedChannelContext
     * @property {MCLinker} client
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
        const { client, serverId, guildId, channelId } = firstItem;
        const server = client.serverConnections.cache.get(serverId);
        if(!server) return null;

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if(!guild) return null;

        const chatChannel = server.chatChannels.find(c => c.id === channelId);
        if(!chatChannel) return null;

        const discordChannel = await guild.channels.fetch(channelId)
            .catch(async err => {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) await this.poolManager.removeChatChannel(server, chatChannel);
                return null;
            });
        if(!discordChannel) return null;

        return { client, server, guild, chatChannel, discordChannel };
    }

    /**
     * Selects a webhook for the given channel context and consumes a rate-limit point.
     * Tries the preferred webhook first (via selectWebhook), then falls back to other
     * webhooks in the pool, and finally attempts to scale up if all are rate-limited.
     * @param {ResolvedChannelContext} ctx - The resolved channel context.
     * @param {QueueItem['kind']} kind - The payload kind (for console affinity selection).
     * @returns {Promise<{ webhookId: ?string, retryMs?: number }>}
     */
    async selectRateLimitedWebhook(ctx, kind) {
        const { chatChannel, server, guild } = ctx;

        const preferredId = await this.poolManager.selectWebhook(chatChannel, server, guild, kind);
        if(!preferredId) return { webhookId: null };

        // Try preferred webhook first
        try {
            await this.limiter.consume(preferredId);
            return { webhookId: preferredId };
        }
        catch(rejected) {
            // Preferred webhook rate-limited — try alternatives in pool
            let bestRetryMs = rejected?.msBeforeNext ?? 250;

            for(const altId of chatChannel.webhooks) {
                if(altId === preferredId) continue;
                try {
                    await this.limiter.consume(altId);
                    this.poolManager.webhookLastActive.set(altId, Date.now());
                    return { webhookId: altId };
                }
                catch(altRejected) {
                    bestRetryMs = Math.min(bestRetryMs, altRejected?.msBeforeNext ?? 250);
                }
            }

            // All webhooks rate-limited — try scaling up
            const newId = await this.poolManager.tryScaleUp(chatChannel, server, guild);
            if(newId) {
                try {
                    await this.limiter.consume(newId);
                    return { webhookId: newId };
                }
                catch { /* should not happen on a fresh webhook */ }
            }

            return { webhookId: null, retryMs: bestRetryMs };
        }
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
            this.poolManager.webhookTokens.delete(webhookId);
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

        logger.error(err, `[Socket.io][Chat] Failed sending queued ${logContext} webhook payload for channel ${chatChannel.id}`);
        return { consumed: 1 };
    }

    /**
     * Callback invoked by the dispatch handler to process a batch of queued items.
     * Selects a webhook and applies per-webhook rate limiting at process time,
     * then routes to the appropriate processor based on the first item's kind.
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

        // Select webhook at process time and apply per-webhook rate limiting.
        // If the preferred webhook is rate-limited, try alternatives in the pool, then scale up.
        const { webhookId, retryMs } = await this.selectRateLimitedWebhook(ctx, firstItem.kind);
        if(retryMs) {
            logger.debug(`[Socket.io][Chat] All webhooks rate limited for channel ${firstItem.channelId}; retry in ${retryMs}ms (items=${items.length}, batchMode=${batchMode})`);
            return { consumed: 0, retryMs };
        }
        if(!webhookId) return { consumed: items.length };

        logger.debug(`[Socket.io][Chat] Processing dispatch queue (kind=${firstItem.kind}, items=${items.length}, batchMode=${batchMode}, webhook=${webhookId})`);

        const webhook = await this.resolver.resolve(ctx.client, ctx.guild, ctx.server, ctx.chatChannel, webhookId);
        if(!webhook) return { consumed: items.length };

        try {
            if(firstItem.kind === 'chat') return await this.processChatQueue(ctx.discordChannel, webhook, items, batchMode);
            if(firstItem.kind === 'console') return await this.processConsoleQueue(ctx.discordChannel, webhook, items);
            return await this.processEmbedQueue(ctx.discordChannel, webhook, items);
        }
        catch(err) {
            return this.handleWebhookSendError(err, items, webhookId, ctx.chatChannel, ctx.server, ctx.guild, firstItem.kind);
        }
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
            logger.error(err, `[Socket.io][Chat] Failed sending high-load skipped summary for channel ${item.channelId}`);
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

            logger.debug(`[Socket.io][Chat] Sending batched chat payload to channel ${channelId} (consumed=${payload.consumed}, length=${payload.content.length})`);

            await webhook.send({
                content: payload.content,
                ...getSystemWebhookSendOptions(discordChannel),
                allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
            });

            return { consumed: payload.consumed, batchMode: items.length - payload.consumed > 2 };
        }
        else {
            const payload = buildChatPayload(items);
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

        logger.debug(`[Socket.io][Chat] Sending embed payload to channel ${channelId} (consumed=${consumed}, embeds=${embeds.length})`);

        await webhook.send({
            embeds,
            ...getSystemWebhookSendOptions(discordChannel),
        });
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
            // Ansi codes are not parsed by discord over 1000 chars
            const charLimit = candidateHasAnsi ? 1000 : 2000;
            if(candidate.length > charLimit && consumed > 0) break;

            combinedRaw = candidate;
            hasAnsi = candidateHasAnsi;
            consumed++;
        }

        if(consumed <= 0) return { consumed: 1 };

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
                    webhookId: webhook.id,
                });
                return { consumed };
            }
            catch(err) {
                if(err?.code === RESTJSONErrorCodes.UnknownChannel) {
                    const server = discordChannel.client.serverConnections.cache.get(discordChannel.guildId);
                    const chatChannel = server?.chatChannels.find(c => c.id === discordChannel.id);
                    if(chatChannel) await this.poolManager.removeChatChannel(server, chatChannel);
                    return { consumed: items.length };
                }

                if(err?.code === RESTJSONErrorCodes.UnknownWebhook || err?.code === RESTJSONErrorCodes.InvalidWebhookToken) throw err;
                // Previous console message no longer editable/deleted; reset and send a fresh message below.
                this.lastConsoleMessages.delete(discordChannel.id);
                logger.debug(`[Socket.io][Chat] Falling back to fresh console webhook send for channel ${discordChannel.id}: ${err?.message ?? 'unknown error'}`);
            }
        }

        logger.debug(`[Socket.io][Chat] Sending new console payload to channel ${discordChannel.id} (consumed=${consumed}, length=${combinedRaw.length})`);
        let sentMessage = await webhook.send({
            content: toAnsiCodeBlock(combinedRaw),
            ...getSystemWebhookSendOptions(discordChannel),
        });

        this.lastConsoleMessages.set(discordChannel.id, {
            id: sentMessage.id,
            raw: combinedRaw,
            hasAnsi,
            webhookId: webhook.id,
        });

        return { consumed };
    }
}
