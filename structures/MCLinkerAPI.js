// noinspection HttpUrlsUsage

import Fastify from 'fastify';
import { getOAuthURL, getTokens, getUser } from '../utilities/oauth.js';
import { createHash, getMinecraftAvatarURL, searchAdvancements } from '../utilities/utils.js';
import { getEmbed, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import { instrument } from '@socket.io/admin-ui';
import fastifyIO from 'fastify-socket.io';
import fastifyStatic from '@fastify/static';
import Discord from 'discord.js';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import logger, { pinoTransport } from '../utilities/logger.js';
import path from 'path';


export default class MCLinkerAPI extends EventEmitter {

    /**
     * @typedef {Object} RouteResponse
     * @property {number?} status - The status code of the response.
     * @property {Object?} body - The body of the response.
     */

    /**
     * The websocket instance for the api.
     * @type {import('socket.io').Server}
     */
    websocket;

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

    /**
     * The rate limiter for stats-channel endpoints.
     * @type {RateLimiterMemory}
     */
    rateLimiterMemberCounter = new RateLimiterMemory({
        keyPrefix: 'member-counters',
        points: 2, // 2 updates
        duration: 60 * 5, // per 5 minutes
    });

    /**
     * The routes for the rest and ws api.
     * @type {{handler: ((Object, ServerConnection) => ?RouteResponse|Promise<?RouteResponse>), endpoint: string, method: string, event: string, rateLimiter?: RateLimiterMemory|((Object) => ?RateLimiterMemory)}[]}
     */
    routes = [
        {
            method: 'POST',
            endpoint: '/chat',
            event: 'chat',
            // Direct method reference not possible because client is not loaded when routes are loaded
            handler: (data, server) => this.chat(data, server),
            rateLimiter: data => data.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels,
        },
        {
            method: 'POST',
            endpoint: '/update-stats-channels',
            event: 'update-stats-channels',
            handler: (data, server) => this.updateStatsChannel(data, server),
            rateLimiter: data => data.event === 'members' ? this.rateLimiterMemberCounter : null,
        },
        {
            method: 'POST',
            endpoint: '/add-synced-role-member',
            event: 'add-synced-role-member',
            handler: (data, server) => this.addSyncedRoleMember(data, server),
        },
        {
            method: 'POST',
            endpoint: '/remove-synced-role-member',
            event: 'remove-synced-role-member',
            handler: (data, server) => this.removeSyncedRoleMember(data, server),
        }, {
            method: 'POST',
            endpoint: '/remove-synced-role',
            event: 'remove-synced-role',
            handler: (data, server) => this.removeSyncedRole(data, server),
        },
        {
            method: 'POST',
            endpoint: '/disconnect-force',
            event: 'disconnect-force',
            handler: (data, server) => this.client.serverConnections.disconnect(server),
        },
        {
            method: 'POST',
            endpoint: '/has-required-role',
            event: 'has-required-role',
            handler: (data, server) => this.hasRequiredRoleToJoin(data, server),
        },
        {
            method: 'POST',
            endpoint: '/verify-user',
            event: 'verify-user',
            handler: data => this.verifyUser(data),
        },
        {
            method: 'POST',
            endpoint: '/invite-url',
            event: 'invite-url',
            handler: (data, server) => this.getInviteUrl(data, server),
        },
        {
            method: 'GET',
            endpoint: '/version',
            event: 'version',
            handler: () => { return { body: process.env.PLUGIN_VERSION }; },
        },
    ];

    /**
     * A map of users that are awaiting verification. The map consists of verification codes and their username and uuid.
     * @type {Map<String, { username: String, uuid: String }>}
     */
    usersAwaitingVerification = new Map();

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
        this.fastify = Fastify({
            logger: { level: process.env.LOG_LEVEL || 'info', transport: pinoTransport },
            /*            https: {
                            key: fs.readFileSync(path.resolve('./private/mclinker.com.key')),
                            cert: fs.readFileSync(path.resolve('./private/mclinker.com.pem')),
                        },*/
        });
        // noinspection JSCheckFunctionSignatures
        this.fastify.register(fastifyIO, {
            cors: {
                origin: ['https://admin.socket.io'],
                credentials: true,
            },
            logLevel: process.env.LOG_LEVEL || 'info',
        });

        this.fastify.register(fastifyStatic, {
            root: path.resolve('./socket.io-admin-ui'), // The path to the static files
            prefix: '/admin/', // optional: default '/'
            logLevel: process.env.LOG_LEVEL || 'info',
        });
        this.fastify.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });

        this.fastify.addHook('preHandler', (request, reply, done) => {
            this.emit(request.url, request, reply);
            done();
        });
    }

    async startServer() {
        async function _getServerFastify(request, reply, client, rateLimiter = null) {
            try {
                if(rateLimiter) await rateLimiter.consume(request.ip);

                if(request.method === 'GET') return;
                else if(!request.body || !request.body.id || !request.body.ip) {
                    reply.status(400).send({ message: 'Bad Request: Missing id and ip' });
                    return;
                }

                const id = request.body.id;
                const ip = request.body.ip.split(':')[0];
                const port = request.body.ip.split(':')[1];

                /** @type {ServerConnection} */
                const server = client.serverConnections.cache.find(server => server.id === id && server.ip === ip && server.port === parseInt(port));
                //If no connection on that guild send disconnection status
                if(!server) reply.status(403).send({});

                //check authorization: Bearer <token>
                if(!request.headers.authorization || createHash(server.token) !== request.headers.authorization?.split(' ')[1]) {
                    reply.status(401).send({});
                    return;
                }

                return server;
            }
            catch(err) {
                if(err instanceof RateLimiterRes) {
                    reply.status(429).headers({
                        'Retry-After': err.msBeforeNext / 1000,
                        'X-RateLimit-Limit': rateLimiter.points,
                        'X-RateLimit-Remaining': err.remainingPoints,
                        'X-RateLimit-Reset': Math.ceil((Date.now() + rateLimiterRes.msBeforeNext) / 1000),
                    }).send({ message: 'Too many requests' });
                }
                else {
                    logger.error(err, 'Error while processing request');
                    reply.status(500).send({ message: 'Internal Server Error' });
                }
            }
        }

        for(const route of this.routes) {
            this.fastify[route.method.toLowerCase()](route.endpoint, async (request, reply) => {
                const rateLimiter = typeof route.rateLimiter === 'function' ? route.rateLimiter(request.body) : route.rateLimiter;
                const server = await _getServerFastify(request, reply, this.client, rateLimiter);
                if(!server && request.method !== 'GET') return;

                const response = await route.handler(request.body, server);
                reply.status(response?.status ?? 200).send(response?.body ?? {});
            });
        }

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
            if(settings) await settings.edit({
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

        this.fastify.get('/', (request, reply) => {
            reply.redirect('https://mclinker.com');
        });

        await this.fastify.ready(); //Await websocket plugin loading
        this.websocket = this.fastify.io;

        instrument(this.websocket, {
            auth: {
                type: 'basic',
                username: process.env.IO_USERNAME,
                password: process.env.IO_PASSWORD,
            },
            mode: 'development',
        });

        this.websocket.engine.on('connection_error', err => logger.error(err, '[Socket.io] Websocket connection error'));

        this.websocket.on('connection', socket => {
            logger.debug(`[Socket.io] Websocket connection from ${socket.handshake.address} with query ${JSON.stringify(socket.handshake.query)}`);

            if(socket.handshake.auth.token) {
                //Reconnection
                const token = socket.handshake.auth.token;
                const hash = createHash(token);

                /** @type {?ServerConnection} */
                const server = this.client.serverConnections.cache.find(server => server.hash === hash);
                if(!server) {
                    if(socket.handshake.auth.code) {
                        //New Connection
                        const [id, userCode] = socket.handshake.auth.code?.split(':') ?? [];

                        /** @type {Connect} */
                        const connectCommand = this.client.commands.get('connect');
                        const wsVerification = connectCommand.wsVerification;

                        if(wsVerification.has(id)) {
                            const {
                                code: serverCode,
                                shard,
                                requiredRoleToJoin,
                                displayIp,
                                online,
                            } = wsVerification.get(id);
                            try {
                                if(!serverCode || serverCode !== userCode) {
                                    logger.debug(`[Socket.io] New Connection from ${socket.handshake.address} with id ${id} failed verification. Disconnecting socket.`);
                                    return socket.disconnect(true);
                                }

                                wsVerification.delete(id);
                                socket.emit('auth-success', { requiredRoleToJoin }); //Tell the plugin that the auth was successful

                                const hash = createHash(socket.handshake.auth.token);
                                /** @type {WebSocketServerConnectionData} */
                                const serverConnectionData = {
                                    id,
                                    ip: socket.handshake.address,
                                    path: socket.handshake.query.path,
                                    chatChannels: [],
                                    statChannels: [],
                                    syncedRoles: [],
                                    online: online ?? socket.handshake.query.online === 'true',
                                    forceOnlineMode: online !== undefined,
                                    floodgatePrefix: socket.handshake.query.floodgatePrefix,
                                    version: Number(socket.handshake.query.version.split('.')[1]),
                                    worldPath: socket.handshake.query.worldPath,
                                    protocol: 'websocket',
                                    socket,
                                    hash,
                                    requiredRoleToJoin,
                                    displayIp,
                                };

                                connectCommand.disconnectOldServer(this.client, id);
                                this.addWebsocketListeners(socket, id, hash);
                                this.client.serverConnections.connect(serverConnectionData).then(server => {
                                    logger.debug(`[Socket.io] Successfully connected ${server.getDisplayIp()} from ${server.id} to websocket`);
                                    this.client.shard.broadcastEval(
                                        (c, { id }) => c.emit('editConnectResponse', id, 'success'),
                                        { context: { id }, shard },
                                    );
                                });
                            }
                            catch(err) {
                                logger.error(err, '[Socket.io] Error while processing websocket connection');
                                this.client.shard.broadcastEval(
                                    (c, {
                                        id,
                                        error,
                                    }) => c.emit('editConnectResponse', id, 'error', { error_stack: error }),
                                    { context: { id, error: err.stack }, shard },
                                );
                                socket.disconnect(true);
                            }
                        }
                        else {
                            logger.debug(`[Socket.io] Connection from ${socket.handshake.address} with id ${id} provided invalid verification. Disconnecting socket.`);
                            return socket.disconnect();
                        }
                    }
                    else {
                        logger.debug(`[Socket.io] No server connection found. Disconnecting socket.`);
                        return socket.disconnect();
                    }
                }
                else {
                    //Update data
                    server.edit({
                        ip: socket.handshake.address,
                        path: socket.handshake.query.path,
                        online: server.forceOnlineMode ? server.online : socket.handshake.query.online === 'true',
                        floodgatePrefix: socket.handshake.query.floodgatePrefix,
                        version: Number(socket.handshake.query.version.split('.')[1]),
                        worldPath: socket.handshake.query.worldPath,
                    });

                    server.protocol.updateSocket(socket);
                    this.addWebsocketListeners(socket, server, hash);
                    logger.debug(`[Socket.io] Successfully reconnected ${server.getDisplayIp()} from ${server.id} to websocket`);
                }
            }
            else {
                logger.debug(`[Socket.io] Connection from ${socket.handshake.address} provided invalid verification. Disconnecting socket.`);
                return socket.disconnect(true);
            }
        });

        await this.fastify.listen({ port: process.env.BOT_PORT, host: '0.0.0.0' });

        return this.fastify;
    }

    /**
     * Adds websocket listeners to the provided socket instance.
     * @param {Socket} socket - The socket to add the listeners to.
     * @param {ServerConnectionResolvable} serverResolvable - The server-connection related to the socket.
     * @param {string} hash - The hash to use for verifying server-connections.
     */
    addWebsocketListeners(socket, serverResolvable, hash) {
        async function getServerWebsocket(client, rateLimiter = null, callback) {
            try {
                if(rateLimiter) await rateLimiter.consume(socket.handshake.address);

                //Update server variable to ensure it wasn't disconnected in the meantime
                /** @type {?ServerConnection} */
                const server = client.serverConnections.cache.find(server => server.hash === hash);

                //If no connection on that guild, disconnect socket
                if(!server) {
                    socket.disconnect();
                    return;
                }
                return server;
            }
            catch(rejRes) {
                callback?.({ message: 'blocked', 'retry-ms': rejRes.msBeforeNext });
            }
        }

        for(const route of this.routes) {
            socket.on(route.event, async (data, callback) => {
                logger.debug(`[Socket.IO] Received event ${route.event} with data: ${JSON.stringify(data)}`);

                data = typeof data === 'string' ? JSON.parse(data) : {};
                const rateLimiter = typeof route.rateLimiter === 'function' ? route.rateLimiter(data) : route.rateLimiter;
                const server = await getServerWebsocket(this.client, rateLimiter, callback);
                logger.debug(`[Socket.IO] Server for event ${route.event}: ${server ? server.getDisplayIp() : 'none'}`);
                if(!server) return;

                const response = await route.handler(data, server);
                logger.debug(`[Socket.IO] Response for event ${route.event}: ${JSON.stringify(response)}`);
                callback?.(response?.body ?? {});
            });
        }

        socket.on('disconnect', reason => {
            /** @type {ServerConnection<WebSocketProtocol>} */
            const server = this.client.serverConnections.resolve(serverResolvable);

            if(!['server namespace disconnect', 'client namespace disconnect'].includes(reason)) {
                server.chatChannels.forEach(chatChannel => {
                    // Send a message to the chat channels that the server has disconnected
                    const channel = this.client.channels.cache.get(chatChannel.id);
                    if(channel) channel.send({ embeds: [getEmbed(keys.api.plugin.warnings.server_disconnected, ph.emojisAndColors())] });
                });
            }

            server.protocol.updateSocket(null);
        });
    }

    /**
     * Handles chat messages.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<void>}
     * @private
     */
    async chat(data, server) {
        const { message, channels, type, player } = data;
        const guildId = server.id;
        const authorURL = await getMinecraftAvatarURL(player);

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

            advancementTitle = advancement[0]?.name ?? message;
            advancementDesc = advancement[0]?.description ?? keys.commands.advancements.no_description_available;

            // Add placeholder to argPlaceholder so it can be used later
            argPlaceholder.advancement_title = advancementTitle;
            argPlaceholder.advancement_description = advancementDesc;
        }
        else if(type === 'death' && (!message || message === '')) argPlaceholder.message = keys.api.plugin.success.default_death_message;

        const chatEmbed = getEmbed(keys.api.plugin.success.messages[type], argPlaceholder, ph.emojisAndColors(), { 'timestamp_now': Date.now() });
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
                    if(err.code === 10003) {
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
                if(err.code === 10003) {
                    const regChannel = await server.protocol.removeChatChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ chatChannels: regChannel.data });
                }
                continue;
            }

            if(!allWebhooks) {
                await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojisAndColors())] });
                return;
            }

            if(!channel.webhook) {
                await discordChannel.send({ embeds: [chatEmbed] }).catch(() => {
                });
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
                        await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook, ph.emojisAndColors())] });
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
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojisAndColors())] });
                    }
                    else {
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.unknown_chat_error, ph.emojisAndColors(), ph.error(err))] });
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

    /**
     * Handles stats-channel updates.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<void>}
     * @private
     */
    async updateStatsChannel(data, server) {
        // event can be one of: 'online', 'offline', 'members'
        const { channels, event } = data;

        const guild = await this.client.guilds.fetch(server.id);
        for(const channel of channels) {
            if(!channel.names[event]) return;

            /** @type {?Discord.TextChannel} */
            let discordChannel;
            try {
                discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;
            }
            catch(err) {
                if(err.code === 10003) {
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ statChannels: regChannel.data });
                }
                continue;
            }

            //Replace %count% with the actual count
            if(event === 'members') channel.names[event] = channel.names[event].replace('%count%', data.members);
            try {
                await discordChannel.setName(channel.names[event]);
            }
            catch(_) {}
        }
    }

    /**
     * Checks whether the minecraft-user has the required role to join the server.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {RouteResponse} - Whether the user has the required role.
     * @private
     */
    async hasRequiredRoleToJoin(data, server) {
        if(!server.requiredRoleToJoin) return true;
        const user = this.client.userConnections.cache.find(u => u.uuid === data.uuid);
        if(!user) return { body: { response: 'not_connected' } };

        try {
            const guild = await this.client.guilds.fetch(server.id);
            const member = await guild.members.fetch({ user: user.id, force: true });

            const canJoin = server.requiredRoleToJoin.method === 'any' && server.requiredRoleToJoin.roles.some(id => member.roles.cache.has(id)) ||
                server.requiredRoleToJoin.method === 'all' && server.requiredRoleToJoin.roles.every(id => member.roles.cache.has(id));
            return { body: { response: canJoin } };
        }
        catch(err) {
            if(err.code === 10007) return false; // Member not in server
            else return { body: { response: 'error', status: 500 } };
        }
    }

    /**
     * Listens to a dm message of the user containing the code to verify the user.
     * @param {Object} data - The request data.
     * @returns {Promise<void>}
     * @private
     */
    verifyUser(data) {
        this.usersAwaitingVerification.set(data.code, { uuid: data.uuid, username: data.username });
        setTimeout(() => this.usersAwaitingVerification.delete(data.code), 180_000);
    }

    /**
     * Returns an existing invite url or creates a new one if none exists.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {RouteResponse} - The invite url.
     * @private
     */
    async getInviteUrl(data, server) {
        let invites;
        let guild;
        try {
            guild = await this.client.guilds.fetch(server.id);
            invites = await guild.invites.fetch();
        }
        catch(_) {}

        if(!guild) return { status: 500 };

        if(invites?.size) return { body: { url: invites.first().url } };
        else {
            /** @type {?Discord.BaseGuildTextChannel} */
            const channel = guild.channels.cache.find(c =>
                c.isTextBased() && c.permissionsFor?.(guild.members.me)?.has(Discord.PermissionFlagsBits.CreateInstantInvite),
            );
            if(!channel) return { status: 500 };
            const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
            return { body: { url: invite.url } };
        }
    }

    /**
     * Adds a member to the synced role in the discord server.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {?RouteResponse}
     * @private
     */
    async addSyncedRoleMember(data, server) {
        await this.updateSyncedRoleMember(data.id, data.uuid, server, 'add');
    }

    /**
     * Removes a member from the synced role in the discord server.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {?RouteResponse}
     * @private
     */
    async removeSyncedRoleMember(data, server) {
        await this.updateSyncedRoleMember(data.id, data.uuid, server, 'remove');
    }

    /**
     * Removes the synced role from the discord server.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<void>}
     * @private
     */
    async removeSyncedRole(data, server) {
        const roleIndex = server.syncedRoles?.findIndex(role => role.id === data.id);
        if(roleIndex === undefined || roleIndex === -1) return;
        server.syncedRoles.splice(roleIndex, 1);
        await server.edit({});
    }

    /**
     * Updates a member in the synced role in the discord server.
     * @param {string} roleId - The id of the role.
     * @param {string} uuid - The uuid of the member.
     * @param {ServerConnection} server - The server connection.
     * @param {'add'|'remove'} addOrRemove - Whether to add or remove the member.
     * @returns {Promise<?RouteResponse>}
     */
    async updateSyncedRoleMember(roleId, uuid, server, addOrRemove) {
        const guild = await this.client.guilds.fetch(server.id);
        if(!guild) return { status: 500 };

        const role = guild.roles.cache.get(roleId);
        if(!role) return { status: 500 };

        const connection = this.client.userConnections.cache.find(conn => conn.uuid === uuid);
        if(!connection) return { status: 404 };

        const roleIndex = server.syncedRoles?.findIndex(r => r.id === role.id);
        if(roleIndex === undefined || roleIndex === -1) return { status: 400 };
        if(addOrRemove === 'add') server.syncedRoles[roleIndex].players.push(connection.uuid);
        else if(addOrRemove === 'remove') server.syncedRoles[roleIndex].players.splice(server.syncedRoles[roleIndex].players.indexOf(connection.uuid), 1);
        await server.edit({});

        try {
            const member = await guild.members.fetch(connection.id);
            if(addOrRemove === 'add') await member.roles.add(role);
            else if(addOrRemove === 'remove') await member.roles.remove(role);
        }
        catch(_) {
            return { status: 500 };
        }
    }
}
