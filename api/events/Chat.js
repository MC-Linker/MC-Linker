import Discord, { PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import WSEvent from '../WSEvent.js';
import keys from '../../utilities/keys.js';
import { getMinecraftAvatarURL, searchAdvancements, toAnsiCodeBlock } from '../../utilities/utils.js';
import { addPh, getEmbed } from '../../utilities/messages.js';
import logger from '../../utilities/logger.js';
import ChatDispatchHandler from './handlers/ChatDispatchHandler.js';


export default class Chat extends WSEvent {

    /**
     * Tracks the latest console message per discord channel for append-by-edit behavior.
     * @type {Map<string, { id: string, raw: string }>}
     */
    lastConsoleMessages = new Map();

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
            points: 4,
            duration: 1,
            onProcess: this.processDispatchQueue.bind(this),
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
        if(['player_command', 'console_command', 'block_command'].includes(type)) {
            // Strip leading slash
            message = message.replace(/^\//, '');

            const commandName = message.split(/\s+/)[0];
            if(server.settings.isDisabled('chatCommands', commandName)) return;
        }

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
                const webhookId = await this.ensureWebhookForChatChannel(channel, server, guild);
                if(!webhookId) continue;

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
                const webhookId = await this.ensureWebhookForChatChannel(channel, server, guild);
                if(!webhookId) continue;

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
                const webhookId = await this.ensureWebhookForChatChannel(channel, server, guild);
                if(!webhookId) continue;

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
        if(bucket === 'chat') return this.processChatQueue(items, batchMode);
        return this.processChannelQueue(items);
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

                await webhook.send({
                    content: payload.content,
                    username: 'Minecraft Chat',
                    avatarURL: 'https://mclinker.com/logo.png',
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                    ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
                });

                return { consumed: payload.consumed, batchMode: items.length - payload.consumed > 2 };
            }
            else {
                const payload = this.buildChatPayload(items);
                if(payload.consumed <= 0) return { consumed: 1 };

                await webhook.send({
                    content: payload.content,
                    username: payload.username,
                    avatarURL: payload.avatarURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                    ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
                });

                return { consumed: payload.consumed, batchMode: false };
            }
        }
        catch(err) {
            if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                chatChannel.webhook = await this.ensureWebhookForChatChannel(chatChannel, server, guild, true);
                if(chatChannel.webhook) {
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

            await webhook.send({
                embeds,
                username: 'MC Linker',
                avatarURL: 'https://mclinker.com/logo.png',
                ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
            });
            return { consumed };
        }
        catch(err) {
            if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                chatChannel.webhook = await this.ensureWebhookForChatChannel(chatChannel, server, guild, true);
                if(chatChannel.webhook) {
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
     * Falls back to sending a new message if appending would exceed the ANSI formatting limit (~1000 chars).
     * @param {Discord.Webhook} webhook - The webhook to send messages with.
     * @param {Discord.TextChannel} discordChannel - The Discord channel to send to.
     * @param {ConsoleQueueItem[]} items - The queued console items to process.
     * @returns {Promise<import('./handlers/ChatDispatchHandler.js').ProcessResult>}
     */
    async processConsoleQueue(webhook, discordChannel, items) {
        let consumed = 0;
        let combinedRaw = '';

        for(const item of items) {
            if(item.kind !== 'console') break;

            // newlines included
            const candidate = `${combinedRaw}${item.raw}`;
            if(candidate.length > 1000 && consumed > 0) break;

            // Single message over 1000
            combinedRaw = candidate;
            consumed++;
        }

        if(consumed <= 0) return { consumed: 1 };

        const webhookSendOptions = {
            username: 'MC Linker',
            avatarURL: 'https://mclinker.com/logo.png',
            ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
        };

        const lastMessage = this.lastConsoleMessages.get(discordChannel.id);
        if(lastMessage && lastMessage.raw.length + combinedRaw.length <= 1000) {
            try {
                const previousMessage = await discordChannel.messages.fetch(lastMessage.id);
                const nextRaw = `${lastMessage.raw}${combinedRaw}`;
                await previousMessage.edit({ content: toAnsiCodeBlock(nextRaw) });
                this.lastConsoleMessages.set(discordChannel.id, {
                    id: previousMessage.id,
                    raw: nextRaw,
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

                logger.error(err, `[Socket.io][Chat] Failed editing console message for channel ${discordChannel.id}`);
                return { consumed: 1 };
            }
        }

        const sentMessage = await webhook.send({ content: toAnsiCodeBlock(combinedRaw), ...webhookSendOptions });
        this.lastConsoleMessages.set(discordChannel.id, {
            id: sentMessage.id,
            raw: combinedRaw,
        });

        return { consumed };
    }

    /**
     * Builds a webhook payload for chat messages, combining consecutive messages from the same player
     * into one message with line breaks, up to Discord's 2000-character limit.
     * @param {ChatQueueItem[]} items - The queued chat items (only leading items from the same player are consumed).
     * @returns {{ consumed: number, content: string, username: string, avatarURL: ?string }}
     */
    buildChatPayload(items) {
        const first = items[0];
        const username = first.player || 'Minecraft';

        let consumed = 0;
        let content = '';
        for(const item of items) {
            if(item.kind !== 'chat') break;
            if((item.player || 'Minecraft') !== username) break;

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
            username,
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
     * Resolves the appropriate webhook for a chat channel, attempting to recreate if missing.
     * @param {Discord.Client} client - The Discord client used to fetch webhooks.
     * @param {Discord.Guild} guild - The guild the channel belongs to.
     * @param {ServerConnection} server - The server connection.
     * @param {ChatChannelData} channelConfig - The chat channel configuration object.
     * @param {string} fallbackWebhookId - Webhook ID to use if channelConfig.webhook is not set.
     * @returns {Promise<?Discord.Webhook>} The resolved webhook, or null if it could not be resolved or created.
     */
    async resolveWebhook(client, guild, server, channelConfig, fallbackWebhookId) {
        let webhookId = channelConfig.webhook ?? fallbackWebhookId;
        if(!webhookId) {
            webhookId = await this.ensureWebhookForChatChannel(channelConfig, server, guild);
            if(!webhookId) return null;
        }

        let webhook = await client.fetchWebhook(webhookId).catch(() => null);

        if(!webhook) {
            const recreatedWebhookId = await this.ensureWebhookForChatChannel(channelConfig, server, guild, true);
            if(!recreatedWebhookId) return null;
            webhook = await client.fetchWebhook(recreatedWebhookId).catch(() => null);
        }

        return webhook;
    }

    /**
     * Ensures a webhook exists for the given chat channel configuration, creating one if necessary.
     * If the webhook is missing or `forceRecreate` is true, a new webhook is created and registered with the server protocol.
     * @param {ChatChannelData} channel - The chat channel configuration to ensure a webhook for.
     * @param {ServerConnection} server - The server connection that owns this chat channel.
     * @param {Discord.Guild} guild - The guild the channel belongs to.
     * @param {boolean} [forceRecreate=false] - If true, always create a new webhook even if one is already set.
     * @returns {Promise<?string>} The webhook ID, or null if it could not be ensured.
     */
    async ensureWebhookForChatChannel(channel, server, guild, forceRecreate = false) {
        if(!forceRecreate && channel.webhook) return channel.webhook;

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

        let webhook;
        try {
            const options = {
                name: 'MC Linker',
                reason: 'ChatChannel to Minecraft',
                avatar: 'https://mclinker.com/logo.png',
            };

            if(discordChannel.isThread()) webhook = await discordChannel.parent.createWebhook(options);
            else webhook = await discordChannel.createWebhook(options);
        }
        catch {
            await discordChannel.send({ embeds: [getEmbed(keys.commands.chatchannel.errors.could_not_create_webhook)] }).catch(() => {});
            return null;
        }

        const regChannel = await server.protocol.addChatChannel({
            id: channel.id,
            webhook: webhook.id,
            types: channel.types,
            allowDiscordToMinecraft: channel.allowDiscordToMinecraft,
        });

        if(!regChannel) {
            await webhook.delete().catch(() => {});
            await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook)] }).catch(() => {});
            return null;
        }

        await server.edit({ chatChannels: regChannel.data });
        channel.webhook = webhook.id;
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
        await server.edit({ chatChannels: regChannel.data });
    }
}