// noinspection HttpUrlsUsage
import Fastify from 'fastify';
import { getOAuthURL, getTokens, getUser } from './oauth.js';
import * as utils from './utils.js';
import { minecraftAvatarURL } from './utils.js';
import { addPh, getEmbed, ph } from './messages.js';
import keys from './keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import fastifyIO from 'fastify-socket.io';
import Discord from 'discord.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export default class BotAPI extends EventEmitter {

    /**
     * The websocket instance for the api.
     * @type {import('socket.io').Server}
     */
    websocket;

    /**
     * The rate limiter for chat-channel endpoints.
     * @type {RateLimiterMemory}
     */
    rateLimiterChatChannels = new RateLimiterMemory({
        keyPrefix: 'chatchannels',
        points: 2, // 1 points
        duration: 1, // per second
    });

    /**
     * The rate limiter for chat-channel endpoints of type chat.
     * @type {RateLimiterMemory}
     */
    rateLimiterChats = new RateLimiterMemory({
        keyPrefix: 'chats',
        points: 20, // 20 points
        duration: 10, // per 10 seconds
    });

    /**
     * The rate limiter for stats-channel endpoints.
     * @type {RateLimiterMemory}
     */
    rateLimiterMemberCounter = new RateLimiterMemory({
        keyPrefix: 'stats-channels',
        points: 2, // 1 points
        duration: 60 * 5, // per 5 minutes
    });

    constructor(client) {
        super();
        super.setMaxListeners(0); // Set unlimited listeners

        /**
         * The client this api is for.
         * @type {MCLinker}
         */
        this.client = client;

        /**
         * The fastify instance for the api.
         * @type {import('fastify').FastifyInstance}
         */
        this.fastify = Fastify();
        // noinspection JSCheckFunctionSignatures
        this.fastify.register(fastifyIO);
        this.fastify.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });

        this.fastify.addHook('preHandler', (request, reply, done) => {
            this.emit(request.url, request, reply);
            done();
        });
    }

    async startServer() {
        async function _getServerFastify(request, reply, client, rateLimiter) {
            try {
                if(rateLimiter) await rateLimiter.consume(request.ip);

                const id = request.body.id;
                const ip = request.body.ip.split(':')[0];
                const port = request.body.ip.split(':')[1];

                /** @type {ServerConnection} */
                const server = client.serverConnections.cache.find(server => server.id === id && server.ip === ip && server.port === port && server.hasHttpProtocol());

                //If no connection on that guild send disconnection status
                if(!server) reply.status(403).send();
                else reply.send({});
            }
            catch(rateLimiterRes) {
                reply.status(429).headers({
                    'Retry-After': rateLimiterRes.msBeforeNext / 1000,
                    'X-RateLimit-Limit': rateLimiter.points,
                    'X-RateLimit-Remaining': rateLimiterRes.remainingPoints,
                    'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext),
                }).send({ message: 'Too many requests' });
            }
        }

        this.fastify.post('/chat', async (request, reply) => {
            const rateLimiter = request.body?.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels;
            const server = await _getServerFastify(request, reply, this.client, rateLimiter);
            if(!server) return;
            await this._chat(request.body, server);
        });

        this.fastify.post('/update-stats-channels', async (request, reply) => {
            const rateLimiter = request.body.event === 'members' ? this.rateLimiterMemberCounter : null;
            const server = await _getServerFastify(request, reply, this.client, rateLimiter);
            if(!server) return;
            await this._updateStatsChannel(request.body);
        });

        this.fastify.get('/linked-role', async (request, reply) => {
            // Generate state
            const { state, url } = getOAuthURL();
            reply.setCookie('state', state, { maxAge: 1000 * 60 * 5, signed: true });
            reply.redirect(url);
        });

        this.fastify.get('/linked-role/callback', async (request, reply) => {
            const { code, state: discordState } = request.query;

            //Check state
            const clientState = reply.unsignCookie(request.cookies.state);
            if(clientState.valid && clientState.value !== discordState) return reply.status(403).send();

            //Get access and refresh token
            const tokens = await getTokens(code);
            if(!tokens) return reply.status(403).send();

            //Get user
            const user = await getUser(this.client, tokens.accessToken);
            if(!user) return reply.status(403).send();

            let settings = this.client.userSettingsConnections.cache.get(user.id);
            if(settings) settings.edit({
                tokens: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expires: tokens.expires,
                },
            });
            else settings = await this.client.userSettingsConnections.connect({
                id: user.id,
                tokens: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expires: tokens.expires,
                },
            });

            const userConnection = this.client.userConnections.cache.get(user.id);
            await settings.updateRoleConnection(userConnection?.username, {
                'connectedaccount': userConnection ? 1 : 0,
            });

            reply.send(`You have been authorized as ${user.tag}! You can now close this window and go back to Discord.`);
        });

        //Returns latest version
        this.fastify.get('/version', () => process.env.PLUGIN_VERSION);
        //Root endpoint
        this.fastify.get('/', (request, reply) => {
            reply.redirect('https://mclinker.com');
        });

        this.fastify.listen({ port: process.env.BOT_PORT, host: '0.0.0.0' }, (err, address) => {
            if(err) throw err;
            console.log(addPh(keys.api.plugin.success.listening.console, { address }));
        });

        await this.fastify.ready(); //Await websocket plugin loading
        this.websocket = this.fastify.io;

        this.websocket.on('connection', socket => {
            const [id] = socket.handshake.auth.code?.split(':') ?? [];

            //Check if awaiting verification (will be handled by connect command)
            if(this.client.commands.get('connect')?.wsVerification?.has(id)) return;

            const token = socket.handshake.auth.token;
            const hash = utils.createHash(token);

            /** @type {?ServerConnection} */
            const server = this.client.serverConnections.cache.find(server => server.hasWebSocketProtocol() && server.hash === hash);
            if(!server) return socket.disconnect();

            socket.emit('auth-success', {}); //Tell the client that the auth was successful

            server.protocol.updateSocket(socket);
            this.addListeners(socket, server, hash);
        });

        this.client.emit('apiReady', this);
        return this.fastify;
    }

    addListeners(socket, server, hash) {
        socket.on('chat', async data => {
            data = JSON.parse(data);
            const rateLimiter = data.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels;
            const server = await getServerWebsocket(this.client, rateLimiter);
            if(!server) return;
            await this._chat(data, server);
        });
        socket.on('update-stats-channels', async data => {
            data = JSON.parse(data);
            const rateLimiter = data.event === 'members' ? this.rateLimiterMemberCounter : null;
            const server = await getServerWebsocket(this.client, rateLimiter);
            if(!server) return;
            await this._updateStatsChannel(data);
        });
        socket.on('disconnect', () => {
            server.protocol.updateSocket(null);
        });

        async function getServerWebsocket(client, rateLimiter) {
            try {
                await rateLimiter.consume(socket.handshake.address);

                //Update server variable to ensure it wasn't disconnected in the meantime
                /** @type {?ServerConnection} */
                const server = client.serverConnections.cache.find(server => server.hasWebSocketProtocol() && server.hash === hash);

                //If no connection on that guild, disconnect socket
                if(!server) {
                    socket.disconnect();
                    return;
                }
                return server;
            }
            catch(rejRes) {
                socket.emit('blocked', { 'retry-ms': rejRes.msBeforeNext });
            }
        }
    }

    /**
     * Handles chat messages
     * @param {Object} data - The chat data
     * @param {ServerConnection} server - The server connection
     * @returns {Promise<void>}
     * @private
     */
    async _chat(data, server) {
        const { message, channels, id: guildId, type, player } = data;
        const authorURL = minecraftAvatarURL(player);

        const argPlaceholder = { username: player, author_url: authorURL, message };

        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type)) {
            const commandName = message.replace(/^\//, '').split(/\s+/)[0];
            if(server.settings.isDisabled('chat-commands', commandName)) return;
        }

        const guild = await this.client.guilds.fetch(guildId);

        let chatEmbed;
        if(type === 'advancement') {
            let advancementTitle;
            let advancementDesc;

            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = utils.searchAdvancements(id, category, false, true, 1);

            advancementTitle = advancement[0]?.name ?? message;
            advancementDesc = advancement[0]?.description ?? keys.commands.advancements.no_description_available;

            chatEmbed = getEmbed(keys.api.plugin.success.messages.advancement, argPlaceholder, {
                'advancement_title': advancementTitle,
                'advancement_description': advancementDesc,
            });
        }
        else if(type === 'chat') {
            //Parse pings (@name)
            const mentions = message.match(/@(\S+)/g);
            for(const mention of mentions ?? []) {
                const users = await guild.members.search({ query: mention.replace('@', '') });
                argPlaceholder.message = argPlaceholder.message.replace(mention, users.first()?.toString() ?? mention);
            }

            chatEmbed = getEmbed(keys.api.plugin.success.messages.chat, argPlaceholder, ph.emojis(), ph.colors());

            let allWebhooks;
            try {
                allWebhooks = await guild.fetchWebhooks();
            }
            catch(_) {}

            for(const channel of channels) {
                if(!server.channels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

                /** @type {?Discord.TextChannel} */
                const discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;

                if(!allWebhooks) {
                    await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojis(), ph.colors())] });
                    return;
                }

                if(!channel.webhook) {
                    try {
                        await discordChannel.send({ embeds: [chatEmbed] });
                    }
                    catch(_) {}
                    continue;
                }

                try {
                    let webhook = allWebhooks.get(channel.webhook);

                    //Create new webhook if old one doesn't exist
                    if(!webhook) {
                        const options = {
                            name: player,
                            reason: 'ChatChannel to Minecraft',
                            avatar: authorURL,
                        };

                        if(discordChannel.isThread()) webhook = await discordChannel.parent.createWebhook(options);
                        else webhook = await discordChannel.createWebhook(options);

                        const regChannel = await server.protocol.addChatChannel({
                            types: channel.types,
                            webhook: webhook.id,
                            id: channel.id,
                        });
                        if(!regChannel) {
                            await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook, ph.emojis(), ph.colors())] });
                            await webhook.delete();
                            return;
                        }

                        await server.edit({ channels: regChannel.data });
                    }

                    //Edit webhook if name doesnt match
                    if(webhook.name !== player) {
                        await webhook.edit({ name: player, avatar: authorURL });
                    }

                    if(discordChannel.isThread()) await webhook.send({
                        threadId: discordChannel.id,
                        content: argPlaceholder.message,
                        allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                    });
                    else await webhook.send({
                        content: argPlaceholder.message,
                        allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                    });
                }
                catch(_) {
                    await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojis(), ph.colors())] });
                    return;
                }
            }
            return;
        }
        else {
            chatEmbed = getEmbed(keys.api.plugin.success.messages[type], argPlaceholder, ph.emojis(), ph.colors(), { 'timestamp_now': Date.now() });
        }

        try {
            for(const channel of channels) {
                if(!server.channels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

                const discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;

                try {
                    await discordChannel?.send({ embeds: [chatEmbed] });
                }
                catch(_) {}
            }
        }
        catch(_) {}
    }

    async _updateStatsChannel(data) {
        // event can be one of: 'online', 'offline', 'members'
        const { channels, event, id } = data;

        const guild = await this.client.guilds.fetch(id);
        for(const channel of channels) {
            if(!channel.names[event]) return;

            const discordChannel = await guild.channels.fetch(channel.id);
            if(!discordChannel) return;

            //Replace %count% with the actual count
            if(event === 'members') channel.names[event] = channel.names[event].replace('%count%', data.members);
            try {
                await discordChannel.setName(channel.names[event]);
            }
            catch(_) {}
        }
    }
}
