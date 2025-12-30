// noinspection HttpUrlsUsage

import Fastify from 'fastify';
import { createHash } from '../../utilities/utils.js';
import { getEmbed } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import { instrument } from '@socket.io/admin-ui';
import fastifyIO from 'fastify-socket.io';
import fastifyStatic from '@fastify/static';
import { Collection } from 'discord.js';
import logger from '../../utilities/logger.js';
import path from 'path';
import fs from 'fs-extra';


export default class MCLinkerAPI extends EventEmitter {

    /**
     * The websocket instance for the api.
     * @type {import('socket.io').Server}
     */
    websocket;

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
         * The WS events for the api mapped by event name.
         * @type {Collection<string, WSEvent>}
         */
        this.wsEvents = new Collection();

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
            transports: ['websocket'],
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
     * Dynamically loads all rest route classes from the routes directory.
     * @returns {Promise<void>}
     */
    async _loadRoutes() {
        const routesPath = path.resolve(this.client.config.restRoutesPath);

        await fs.ensureDir(routesPath);
        const files = await fs.readdir(routesPath);

        for(const file of files) {
            if(!file.endsWith('.js')) continue;

            const { default: RouteClass } = await import(path.join(routesPath, file));
            /** @type {Route} */
            const route = new RouteClass();

            this.restRoutes.push(route);
            logger.info(`Loaded REST route: ${route.endpoint}`);
        }
    }

    /**
     * Dynamically loads all events classes from the wsEvents directory.
     * @returns {Promise<void>}
     */
    async _loadWSEvents() {
        const wsEventsPath = path.resolve(this.client.config.wsEventsPath);

        await fs.ensureDir(wsEventsPath);
        const files = await fs.readdir(wsEventsPath);

        for(const file of files) {
            if(!file.endsWith('.js')) continue;

            const { default: WSEventClass } = await import(path.join(wsEventsPath, file));
            /** @type {WSEvent} */
            const wsEvent = new WSEventClass();

            this.wsEvents.set(wsEvent.event, wsEvent);
            logger.info(`Loaded WS event: ${wsEvent.event}`);
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
        await this._loadWSEvents();

        for(const route of this.restRoutes) {
            if(route.customBot && process.env.CUSTOM_BOT !== 'true') continue;

            for(const method of route.methods) {
                this.fastify[method.toLowerCase()](route.endpoint, async (request, reply) => {
                    if(route.customBot && process.env.COMMUNICATION_TOKEN !== request.headers['x-communication-token'])
                        return reply.status(401).send({ message: 'Unauthorized' });

                    const response = await route[method.toLowerCase()](this.client, request, reply);
                    if(!response) return; //Response already sent
                    logger.debug(`[Fastify] Response for ${method} ${route.endpoint}: ${response?.toString()}`);
                    reply.status(response?.status ?? 200).send(response?.body ?? {});
                });
            }
        }

        await this.fastify.ready(); //Await websocket plugin loading
        this.websocket = this.fastify.io;

        this.websocket.use(this.wsMiddleware.bind(this)); // Bind this as it's called in a different context

        this.websocket.on('connection', this.wsHandleConnection.bind(this));

        instrument(this.websocket, {
            auth: {
                type: 'basic',
                username: process.env.IO_USERNAME,
                password: process.env.IO_PASSWORD,
            },
            mode: 'development',
        });

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
    async wsMiddleware(socket, next) {
        logger.debug(`[Socket.io] Websocket connection from ${socket.handshake.address} with query ${JSON.stringify(socket.handshake.query)}`);

        // Basic auth for admin-ui
        if(socket.handshake.auth.username && socket.handshake.auth.password) return next();

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
     * Handles a new successful websocket connection (emitting event to acknowledge auth-success and send setup data).
     * @param {Socket} socket - The socket that connected.
     */
    async wsHandleConnection(socket) {
        const [id] = socket.handshake.auth.code?.split(':') ?? [];

        /** @type {Connect} */
        const connectCommand = this.client.commands.get('connect');
        const wsVerification = connectCommand.wsVerification;

        if(!wsVerification.has(id)) return; //Not a new connection

        const { requiredRoleToJoin } = wsVerification.get(id);
        wsVerification.delete(id);

        socket.emit('auth-success', { requiredRoleToJoin }); //Tell the plugin that the auth was successful
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

        const route = this.wsEvents.get(eventName);
        const rateLimiter = typeof route.rateLimiter === 'function' ? route.rateLimiter(data) : route.rateLimiter;
        try {
            await rateLimiter?.consume(socket.handshake.address);
        }
        catch(rejRes) {
            callback?.({ message: 'blocked', 'retry-ms': rejRes.msBeforeNext });
            return;
        }

        //Update server variable to ensure it wasn't disconnected in the meantime
        //TODO optimize lookup with hash map
        /** @type {?ServerConnection} */
        const server = this.client.serverConnections.cache.find(server => server.hash === hash);

        logger.debug(`[Socket.IO] Found server for event ${route.event}: ${server ? server.displayIp : 'none'}`);

        //If no connection on that guild, disconnect socket
        if(!server) return socket.disconnect();

        try {
            const response = await route.execute(data, server, this.client);
            logger.debug(`[Socket.IO] Response for event ${route.event}: ${response?.toString()}`);
            callback?.(response);
        }
        catch(err) {
            logger.error(err, `[Socket.IO] Error executing event ${route.event}`);
            callback?.({ message: 'server_error' });
        }
    }

    /**
     * Adds websocket listeners to the provided socket instance.
     * @param {Socket} socket - The socket to add the listeners to.
     * @param {ServerConnectionResolvable} serverResolvable - The server-connection related to the socket.
     * @param {string} hash - The hash to use for verifying server-connections.
     */
    addWebsocketListeners(socket, serverResolvable, hash) {
        for(const route of this.wsEvents.values())
            socket.on(route.event, this.wsEventHandler.bind(this, socket, route.event, hash));

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
     * Updates a member in the synced role in the discord server.
     * @param {string} roleId - The id of the role.
     * @param {string} uuid - The uuid of the member.
     * @param {ServerConnection} server - The server connection.
     * @param {'add'|'remove'} addOrRemove - Whether to add or remove the member.
     * @returns {Promise<void>}
     */
    async updateSyncedRoleMember(roleId, uuid, server, addOrRemove) {
        const connection = this.client.userConnections.cache.find(conn => conn.uuid === uuid);
        if(!connection) return;

        const guild = await this.client.guilds.fetch(server.id);
        if(!guild) return;

        const role = guild.roles.cache.get(roleId);
        if(!role) return;

        const roleIndex = server.syncedRoles?.findIndex(r => r.id === role.id);
        if(roleIndex === undefined || roleIndex === -1) return;
        if(addOrRemove === 'add') server.syncedRoles[roleIndex].players.push(connection.uuid);
        else if(addOrRemove === 'remove') server.syncedRoles[roleIndex].players.splice(server.syncedRoles[roleIndex].players.indexOf(connection.uuid), 1);
        await server.edit({});

        try {
            const member = await guild.members.fetch(connection.id);
            if(addOrRemove === 'add') await member.roles.add(role);
            else if(addOrRemove === 'remove') await member.roles.remove(role);
        }
        catch(_) {}
    }
}
