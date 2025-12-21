import { RateLimiterMemory } from 'rate-limiter-flexible';
import Discord, { RESTJSONErrorCodes } from 'discord.js';
import Route from '../../structures/api/Route.js';
import keys from '../../utilities/keys.js';
import { getMinecraftAvatarURL, searchAdvancements } from '../../utilities/utils.js';
import { getEmbed } from '../../utilities/messages.js';


export default class Chat extends Route {

    /**
     * @typedef {Object} ChatRequest
     * @property {'chat'|'join'|'quit'|'death'|'advancement'|'player_command'|'console_command'|'block_command'|'start'|'close'} type
     * @property {string} message
     * @property {string} player
     * @property {string} [uuid]
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
     * Handles a WS event for this route.
     * @param {ChatRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async ws(data, server, client) {
        const { message, type, player } = data;
        const guildId = server.id;
        const authorURL = await getMinecraftAvatarURL(player);

        const channels = server.chatChannels.filter(c => c.types.includes(type));
        if(channels.length === 0) return; //No channels to send to

        const argPlaceholder = { username: player, author_url: authorURL, message };
        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type)) {
            const commandName = message.replace(/^\//, '').split(/\s+/)[0];
            if(server.settings.isDisabled('chatCommands', commandName)) return;
        }

        const guild = await this.client.guilds.fetch(guildId);

        //Add special placeholders for advancements
        if(type === 'advancement') {
            let advancementTitle;
            let advancementDesc;

            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = searchAdvancements(id, category, false, true, 1);

            if(!advancement[0]) return; // Advancement not found

            advancementTitle = advancement[0]?.name ?? message;
            advancementDesc = advancement[0]?.description ?? keys.commands.advancements.no_description_available;

            // Add placeholder to argPlaceholder so it can be used later
            argPlaceholder.advancement_title = advancementTitle;
            argPlaceholder.advancement_description = advancementDesc;
        }
        else if(type === 'death' && (!message || message === '')) argPlaceholder.message = addPh(keys.api.plugin.success.default_death_message, argPlaceholder);

        const chatEmbed = getEmbed(keys.api.plugin.success.messages[type], argPlaceholder, { 'timestamp_now': Date.now() });
        if(type !== 'chat') {
            for(const channel of channels) {
                if(!server.chatChannels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

                /** @type {?Discord.TextChannel} */
                let discordChannel;
                try {
                    discordChannel = await guild.channels.fetch(channel.id);
                    if(!discordChannel) continue;
                    await discordChannel?.send({ embeds: [chatEmbed] });
                }
                catch(err) {
                    if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                        const regChannel = await server.protocol.removeChatChannel(channel);
                        if(!regChannel) continue;
                        await server.edit({ chatChannels: regChannel.data });
                    }
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
            argPlaceholder.message = argPlaceholder.message.replace(mention, users.first()?.toString() ?? mention);
        }

        const allWebhooks = await guild.fetchWebhooks().catch(() => {});

        for(const channel of channels) {
            if(!server.chatChannels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

            /** @type {?Discord.TextChannel} */
            let discordChannel;
            try {
                discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;
            }
            catch(err) {
                if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const regChannel = await server.protocol.removeChatChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ chatChannels: regChannel.data });
                }
                continue;
            }

            if(!allWebhooks) {
                await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission)] });
                return;
            }

            if(!channel.webhook) {
                await discordChannel.send({ embeds: [chatEmbed] }).catch(() => {});
                continue;
            }

            try {
                let webhook = allWebhooks.get(channel.webhook);

                //Create new webhook if old one doesn't exist
                if(!webhook) {
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

                if(discordChannel.isThread()) await webhook.send({
                    threadId: discordChannel.id,
                    content: argPlaceholder.message,
                    username: player,
                    avatarURL: authorURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });
                else await webhook.send({
                    content: argPlaceholder.message,
                    username: player,
                    avatarURL: authorURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });
            }
            catch(err) {
                try {
                    if(discordChannel.permissionsFor(guild.members.me).has(Discord.PermissionFlagsBits.ManageWebhooks)) {
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission)] });
                    }
                    else {
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.unknown_chat_error, ph.error(err))] });
                    }
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