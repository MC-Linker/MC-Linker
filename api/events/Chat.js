import { RateLimiterMemory } from 'rate-limiter-flexible';
import Discord, { RESTJSONErrorCodes } from 'discord.js';
import WSEvent from '../../structures/api/WSEvent.js';
import keys from '../../utilities/keys.js';
import { getMinecraftAvatarURL, searchAdvancements } from '../../utilities/utils.js';
import { addPh, getEmbed, ph } from '../../utilities/messages.js';
import logger from '../../utilities/logger.js';


export default class Chat extends WSEvent {

    /**
     * @typedef {Object} ChatRequest
     * @property {'chat'|'join'|'quit'|'death'|'advancement'|'player_command'|'console_command'|'block_command'|'start'|'close'} type
     * @property {string} message
     * @property {string} [player] - Required for type 'chat', 'join', 'quit', 'death', 'advancement', 'player_command'
     */

    /**
     * The rate limiter for chat-channel endpoints that are not of type chat.
     * @type {RateLimiterMemory}
     */
    rateLimiterChatChannels = new RateLimiterMemory({
        keyPrefix: 'chatchannels',
        points: 2, // 2 updates
        duration: 1, // per second
    });

    /**
     * The rate limiter for chat-channel endpoints of type chat.
     * @type {RateLimiterMemory}
     */
    rateLimiterChats = new RateLimiterMemory({
        keyPrefix: 'chats',
        points: 5, // 5 messages
        duration: 2, // per 2 seconds
    });

    constructor() {
        super({
            event: 'chat',
            rateLimiter: data => data.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels,
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
        const { message, type, player } = data;

        const channels = server.chatChannels.filter(c => c.types.includes(type));
        if(channels.length === 0) return; //No channels to send to

        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type)) {
            const commandName = message.replace(/^\//, '').split(/\s+/)[0];
            if(server.settings.isDisabled('chatCommands', commandName)) return;
        }

        const guildId = server.id;
        const authorURL = player ? await getMinecraftAvatarURL(player) : null;

        const placeholders = { username: player, author_url: authorURL, message };

        //Add special placeholders for advancements
        if(type === 'advancement') {
            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = searchAdvancements(id, category, false, true, 1);

            if(!advancement[0]) return; // Advancement not found

            const advancementTitle = advancement[0]?.name ?? message;
            const advancementDesc = advancement[0]?.description ?? keys.commands.advancements.no_description_available;

            // Add placeholder to argPlaceholder so it can be used later
            placeholders.advancement_title = advancementTitle;
            placeholders.advancement_description = advancementDesc;
        }
        else if(type === 'death' && (!message || message === '')) placeholders.message = addPh(keys.api.plugin.success.default_death_message, placeholders);

        const guild = await client.guilds.fetch(guildId);
        const chatEmbed = getEmbed(keys.api.plugin.success.messages[type], placeholders, { 'timestamp_now': Date.now() });
        if(type !== 'chat') {
            for(const channel of channels) {
                /** @type {?Discord.TextChannel} */
                try {
                    logger.debug(`[Socket.io][Chat] Fetching channel for non-chat message`);
                    const discordChannel = await guild.channels.fetch(channel.id);
                    if(!discordChannel) continue;
                    logger.debug(`[Socket.io][Chat] Sending non-chat message to channel`);
                    await discordChannel?.send({ embeds: [chatEmbed] });
                }
                catch(err) {
                    if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                        logger.debug(`[Socket.io][Chat] Removing unknown channel from chat channels`);
                        const regChannel = await server.protocol.removeChatChannel(channel);
                        if(!regChannel) continue;
                        await server.edit({ chatChannels: regChannel.data });
                    }
                    logger.error(`[Socket.io][Chat] Error fetching channel: ${err.message}`);
                }
            }
            return;
        }

        //type === 'chat'

        if(message === '' || message === null) return; //Ignore empty messages

        //Parse pings (@name)
        const mentions = message.match(/@(\S+)/g);
        for(const mention of mentions ?? []) {
            if(mention.length > 101) continue; //101 because of the @
            const users = await guild.members.search({ query: mention.replace('@', ''), limit: 1 });
            if(users.first()?.username !== mention.replace('@', '')) continue;
            placeholders.message = placeholders.message.replace(mention, users.first()?.toString() ?? mention);
        }

        const allWebhooks = await guild.fetchWebhooks().catch(() => {});

        for(const channel of channels) {
            /** @type {?Discord.TextChannel} */
            let discordChannel;
            try {
                logger.debug(`[Socket.io][Chat] Fetching channel`);
                discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;
            }
            catch(err) {
                if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    logger.debug(`[Socket.io][Chat] Removing unknown channel from chat channels`);
                    const regChannel = await server.protocol.removeChatChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ chatChannels: regChannel.data });
                }
                logger.error(`[Socket.io][Chat] Error fetching channel: ${err.message}`);
                continue;
            }

            if(!allWebhooks) {
                logger.debug(`[Socket.io][Chat] Could not fetch webhooks for guild ${guild.id}. Sending warning.`);
                await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission)] });
                return;
            }

            if(!channel.webhook) {
                logger.debug(`[Socket.io][Chat] No webhook registered for channel ${discordChannel.id}. Sending message normally.`);
                await discordChannel.send({ embeds: [chatEmbed] }).catch(() => {});
                continue;
            }

            try {
                let webhook = allWebhooks.get(channel.webhook);

                //Create new webhook if old one doesn't exist
                if(!webhook) {
                    logger.debug(`[Socket.io][Chat] Creating new webhook for channel ${discordChannel.id}.`);
                    const options = {
                        name: 'MC Linker',
                        reason: 'ChatChannel to Minecraft',
                        avatar: 'https://mclinker.com/assets/mclinkerlogo.png',
                    };
                    if(discordChannel.isThread()) webhook = await discordChannel.parent.createWebhook(options);
                    else webhook = await discordChannel.createWebhook(options);

                    const regChannel = await server.protocol.addChatChannel({
                        types: channel.types,
                        webhook: webhook.id,
                        id: channel.id,
                    });
                    if(!regChannel) {
                        await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook)] });
                        await webhook.delete();
                        return;
                    }

                    await server.edit({ chatChannels: regChannel.data });
                }

                logger.debug(`[Socket.io][Chat] Sending message to channel ${discordChannel.id} via webhook.`);
                if(discordChannel.isThread()) await webhook.send({
                    threadId: discordChannel.id,
                    content: placeholders.message,
                    username: player,
                    avatarURL: authorURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });
                else await webhook.send({
                    content: placeholders.message,
                    username: player,
                    avatarURL: authorURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });
            }
            catch(err) {
                try {
                    logger.error(`[Socket.io][Chat] Error sending message via webhook: ${err.message}`);
                    if(discordChannel.permissionsFor(guild.members.me).has(Discord.PermissionFlagsBits.ManageWebhooks))
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission)] });
                    else
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.unknown_chat_error, ph.error(err))] });
                }
                catch(_) {
                    const regChannel = await server.protocol.removeChatChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ chatChannels: regChannel.data });
                }
            }
        }
    }
}