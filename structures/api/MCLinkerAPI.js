// noinspection HttpUrlsUsage

import Fastify from 'fastify';
import { getOAuthURL, getTokens, getUser } from '../../utilities/oauth.js';
import { createHash } from '../../utilities/utils.js';
import { getEmbed } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import { instrument } from '@socket.io/admin-ui';
import fastifyIO from 'fastify-socket.io';
import fastifyStatic from '@fastify/static';
import Discord, { Collection, RESTJSONErrorCodes } from 'discord.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../../utilities/logger.js';
import path from 'path';
import MCLinker from '../MCLinker.js';
import fs from 'fs-extra';


export default class MCLinkerAPI extends EventEmitter {

    /**
     * @typedef {object} RouteResponse
     * @property {number?} status - The status code of the response.
     * @property {object?} body - The body of the response.
     */

    /**
     * The websocket instance for the api.
     * @type {import('socket.io').Server}
     */
    websocket;

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
     * @type {Object[]}
     * @property {string} method
     * @property {string} endpoint
     * @property {string} event
     * @property {boolean} requiresServer
     * @property {boolean=false} customBot
     * @property {(data: Object, server: ?ServerConnection) => ?RouteResponse|Promise<?RouteResponse>} handler
     * @property {RateLimiterMemory|((data: Object) => ?RateLimiterMemory)} rateLimiter
     */
    routesOld = [
        {
            method: 'POST',
            endpoint: '/chat',
            event: 'chat',
            requiresServer: true,
            // Direct method reference not possible because client is not loaded when routes are loaded
            handler: (data, server) => this.chat(data, server),
            rateLimiter: data => data.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels,
        },
        {
            method: 'POST',
            endpoint: '/update-stats-channels',
            event: 'update-stats-channels',
            requiresServer: true,
            handler: (data, server) => this.updateStatsChannel(data, server),
            rateLimiter: data => data.event === 'members' ? this.rateLimiterMemberCounter : null,
        },
        {
            method: 'POST',
            endpoint: '/add-synced-role-member',
            event: 'add-synced-role-member',
            requiresServer: true,
            handler: (data, server) => this.addSyncedRoleMember(data, server),
        },
        {
            method: 'POST',
            endpoint: '/remove-synced-role-member',
            event: 'remove-synced-role-member',
            requiresServer: true,
            handler: (data, server) => this.removeSyncedRoleMember(data, server),
        }, {
            method: 'POST',
            endpoint: '/remove-synced-role',
            event: 'remove-synced-role',
            requiresServer: true,
            handler: (data, server) => this.removeSyncedRole(data, server),
        },
        {
            method: 'POST',
            endpoint: '/disconnect-force',
            event: 'disconnect-force',
            requiresServer: true,
            handler: (data, server) => this.client.serverConnections.disconnect(server),
        },
        {
            method: 'POST',
            endpoint: '/has-required-role',
            event: 'has-required-role',
            requiresServer: true,
            handler: (data, server) => this.hasRequiredRoleToJoin(data, server),
        },
        {
            method: 'POST',
            endpoint: '/verify-user',
            event: 'verify-user',
            requiresServer: true,
            handler: data => this.verifyUser(data),
        },
        {
            method: 'POST',
            endpoint: '/invite-url',
            event: 'invite-url',
            requiresServer: true,
            handler: (data, server) => this.getInviteUrl(data, server),
        },
        {
            method: 'GET',
            endpoint: '/version',
            event: 'version',
            requiresServer: false,
            handler: () => {
                return { body: this.client.config.pluginVersion };
            },
        },
        {
            method: 'POST',
            endpoint: '/presence',
            requiresServer: false,
            customBot: true,
            handler: async (data, _) => {
                try {
                    await this.client.user.setPresence(data);
                    this.client.config.presence = data;
                    await MCLinker.writeConfig(this.client.config);
                }
                catch(err) {
                    logger.error(err, 'Error while setting custom bot presence');
                    return { status: 500, body: err };
                }
            },
        },
        {
            method: 'POST',
            endpoint: '/pre-delete-cleanup',
            requiresServer: false,
            customBot: true,
            handler: async (_, __) => {
                for(const server of this.client.serverConnections.cache.values())
                    await this.client.serverConnections.disconnect(server);
                console.log('All server connections disconnected.');

                this.client.mongo.connection.db.dropDatabase();
                console.log(`${this.client.mongo.connection.db.databaseName} database dropped.`);
            },
        },
        {
            method: 'POST',
            endpoint: '/custom-bot-api-ready',
            requiresServer: false,
            handler: async (_, __) => {}, // Just acknowledge the custom bot is ready (send 200)
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
         * The REST routes for the api.
         * @type {Route[]}
         */
        this.restRoutes = [];

        /**
         * The WS routes for the api mapped by event name.
         * @type {Collection<string, Route>}
         */
        this.wsRoutes = new Collection();

        /**
         * The fastify instance for the api.
         * @type {import('fastify').FastifyInstance}
         */
        this.fastify = Fastify({
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
            transports: ['polling', 'websocket'], //TODO remove polling
            logLevel: process.env.LOG_LEVEL || 'info',
        });

        this.fastify.register(fastifyStatic, {
            root: path.resolve('./socket.io-admin-ui'), // The path to the static files
            prefix: '/admin/', // optional: default '/'
            logLevel: process.env.LOG_LEVEL || 'info',
        });
        this.fastify.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });

        this.fastify.addHook('preHandler', (request, reply, done) => {
            logger.debug(`[Fastify] ${request.method} request to ${request.url} from ${request.ip}: ${request.body}`);
            this.emitToAllShards(request.url, request);
            done();
        });
    }

    /**
     * Dynamically loads all route classes from the routes directory.
     * @returns {Promise<void>}
     */
    async _loadRoutes() {
        const routesPath = path.resolve(this.client.config.routesPath);

        await fs.ensureDir(routesPath);
        const files = await fs.readdir(routesPath);

        for(const file of files) {
            if(!file.endsWith('.js')) continue;

            const { default: RouteClass } = await import(path.join(routesPath, file));
            const route = new RouteClass();

            if(route.endpoint) {
                this.restRoutes.push(route);
                logger.info('Loaded route:', route.endpoint, route.event);
            }
            if(route.event) {
                this.wsRoutes.set(route.event, route);
                logger.info('Loaded WS route:', route.event);
            }
        }
    }

    /**
     * Emits an event across all shards.
     * @param {string} event - The event to emit (the REST endpoint).
     * @param {import('fastify').FastifyRequest} request - The request object.
     */
    emitToAllShards(event, request) {
        const args = {
            method: request.method,
            body: request.body,
            headers: request.headers,
        };
        this.client.shard.broadcastEval((c, { event, args }) => c.api.emit(event, args), {
            context: {
                event,
                args,
            },
        });
    }

    async startServer() {
        await this._loadRoutes();

        for(const route of this.restRoutes) {
            if(!route.endpoint) continue;
            if(route.customBot && process.env.CUSTOM_BOT !== 'true') continue;

            for(const method of route.methods) {
                this.fastify[method.toLowerCase()](route.endpoint, async (request, reply) => {
                    if(route.customBot && process.env.COMMUNICATION_TOKEN !== request.headers['x-communication-token'])
                        return reply.status(401).send({ message: 'Unauthorized' });

                    const response = await route[method.toLowerCase()](request, reply);
                    logger.debug(`[Fastify] Response for ${method} ${route.endpoint}: ${response.toString()}`);
                    reply.status(response?.status ?? 200).send(response?.body ?? {});
                });
            }
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
        });

        this.websocket.use(this.wsHandleConnection);

        this.websocket.engine.on('connection_error', err => logger.error(err, '[Socket.io] Websocket connection error'));

        await this.fastify.listen({ port: process.env.BOT_PORT, host: '0.0.0.0' }, (err, address) => {
            if(err) {
                logger.fatal(err, 'Error starting API server');
                process.exit(1);
            }
            logger.info(`Server listening at ${address}`);
        });

        if(process.env.CUSTOM_BOT === 'true') await this.notifyMainBotOfStart();

        return this.fastify;
    }

    /**
     * Handles a websocket connection (authentication, reconnection, new connection).
     * @param {Socket} socket - The socket that is trying to connect.
     * @param {Function} next - Callback to continue or close the connection.
     */
    async wsHandleConnection(socket, next) {
        logger.debug(`[Socket.io] Websocket connection from ${socket.handshake.address} with query ${JSON.stringify(socket.handshake.query)}`);

        if(!socket.handshake.auth.token) {
            logger.debug(`[Socket.io] Connection from ${socket.handshake.address} provided invalid verification. Disconnecting socket.`);
            return next(new Error('Unauthorized'));
        }

        const token = socket.handshake.auth.token;
        const hash = createHash(token);

        // Find existing server connection
        /** @type {?ServerConnection} */
        const server = this.client.serverConnections.cache.find(server => server.hash === hash);

        if(server) {
            // Reconnection
            // Update data
            await server.edit({
                ip: socket.handshake.address,
                path: socket.handshake.query.path,
                online: server.forceOnlineMode ? server.online : socket.handshake.query.online === 'true',
                floodgatePrefix: socket.handshake.query.floodgatePrefix,
                version: Number(socket.handshake.query.version.split('.')[1]),
                worldPath: socket.handshake.query.worldPath,
            });
            server.protocol.updateSocket(socket);

            this.addWebsocketListeners(socket, server, hash);
            logger.debug(`[Socket.io] Successfully reconnected ${server.displayIp} from ${server.id} to websocket`);
            return next();
        }

        if(!server && socket.handshake.auth.code) {
            // New Connection
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
                        return next(new Error('Unauthorized'));
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

                    await connectCommand.disconnectOldServer(this.client, id);
                    this.addWebsocketListeners(socket, id, hash);
                    this.client.serverConnections.connect(serverConnectionData).then(server => {
                        logger.debug(`[Socket.io] Successfully connected ${server.displayIp} from ${server.id} to websocket`);
                        this.client.shard.broadcastEval(
                            (c, { id }) => c.emit('editConnectResponse', id, 'success'),
                            { context: { id }, shard },
                        );
                    });
                    next();
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
                    next(new Error('Server Error'));
                }
            }
            else {
                logger.debug(`[Socket.io] Connection from ${socket.handshake.address} with id ${id} provided invalid verification. Disconnecting socket.`);
                next(new Error('Unauthorized'));
            }
        }
        else {
            logger.debug(`[Socket.io] No server connection found. Disconnecting socket.`);
            next(new Error('Unauthorized'));
        }
    }

    /**
     * Handles a websocket event (rate limit, server lookup, response)
     * @param {Socket} socket - The socket that sent the event.
     * @param {string} eventName - The name of the event.
     * @param {string} hash - The hash to use for verifying server-connections.
     * @param {Object|string} data - The data sent with the event.
     * @param {Function} callback - The callback to send the response to.
     */
    async wsEventHandler(socket, eventName, hash, data, callback) {
        logger.debug(`[Socket.IO] Received event ${eventName} with data: ${data.toString()}`);

        try {
            data = typeof data === 'string' ? JSON.parse(data) : {};
        }
        catch(err) {
            logger.error(err, `[Socket.IO] Error parsing data for event ${eventName}`);
            return callback?.({ message: 'invalid_json' });
        }

        const route = this.wsRoutes.get(eventName);
        const rateLimiter = typeof route.rateLimiter === 'function' ? route.rateLimiter(data) : route.rateLimiter;
        try {
            await rateLimiter.consume(socket.handshake.address);

            //Update server variable to ensure it wasn't disconnected in the meantime
            /** @type {?ServerConnection} */
            const server = this.client.serverConnections.cache.find(server => server.hash === hash);

            logger.debug(`[Socket.IO] Server for event ${route.event}: ${server ? server.displayIp : 'none'}`);

            //If no connection on that guild, disconnect socket
            if(!server && route.requiresServer) return socket.disconnect();

            const response = await route.ws(data, server, this.client);
            logger.debug(`[Socket.IO] Response for event ${route.event}: ${response.toString()}`);
            callback?.(response?.body ?? {});
        }
        catch(rejRes) {
            callback?.({ message: 'blocked', 'retry-ms': rejRes.msBeforeNext });
        }
    }

    /**
     * Adds websocket listeners to the provided socket instance.
     * @param {Socket} socket - The socket to add the listeners to.
     * @param {ServerConnectionResolvable} serverResolvable - The server-connection related to the socket.
     * @param {string} hash - The hash to use for verifying server-connections.
     */
    addWebsocketListeners(socket, serverResolvable, hash) {
        for(const route of this.wsRoutes.values()) {
            if(!route.event) continue;
            socket.on(route.event, this.wsEventHandler.bind(this, socket, route.event, hash));
        }

        socket.on('disconnect', reason => {
            logger.debug(`[Socket.IO] Disconnected from ${socket.handshake.address} with reason: ${reason}`);

            /** @type {ServerConnection<WebSocketProtocol>} */
            const server = this.client.serverConnections.resolve(serverResolvable);

            if(!['server namespace disconnect', 'client namespace disconnect'].includes(reason)) {
                server.chatChannels.forEach(chatChannel => {
                    // Send a message to the chat channels that the server has disconnected
                    const channel = this.client.channels.cache.get(chatChannel.id);
                    if(channel) channel.send({ embeds: [getEmbed(keys.api.plugin.warnings.server_disconnected)] });
                });
            }

            server.protocol.updateSocket(null);
        });
    }

    async notifyMainBotOfStart() {
        const res = await fetch(`http://mc-linker/custom-bot-api-ready`, {
            method: 'POST',
            headers: { 'x-communication-token': process.env.COMMUNICATION_TOKEN },
        });
        if(!res.ok) {
            logger.fatal(res, 'Could not notify main bot of custom bot start');
            process.exit(1);
        }
        logger.info('Notified main bot of custom bot start');
    }

    /**
     * Handles chat messages.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<void>}
     * @private
     */
    async chat(data, server) {

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
        const { event } = data;

        const eventToTypeMap = {
            'online': 'status',
            'offline': 'status',
            'members': 'member-counter',
        };

        const channels = server.statChannels.filter(c => c.type === eventToTypeMap[event]);
        if(channels.length === 0) return; //No channels to update

        for(const channel of channels) {
            try {
                const discordChannel = await this.client.channels.fetch(channel.id);
                //Replace %count% with the actual count
                let newName;
                if(event === 'members') newName = channel.names[event].replace('%count%', data.members);
                else newName = channel.names[event];
                await discordChannel.setName(newName);
            }
            catch(err) {
                if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ statChannels: regChannel.data });
                }
            }
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
            if(err.code === RESTJSONErrorCodes.UnknownMember) return false; // Member not in server
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
            if(guild.vanityURLCode) return { body: { url: `https://discord.gg/${guild.vanityURLCode}` } };
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
