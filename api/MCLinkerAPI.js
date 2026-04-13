import Fastify from 'fastify';
import { createHash, evalOnGuildShard } from '../utilities/utils.js';
import { getEmbed } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import { instrument } from '@socket.io/admin-ui';
import fastifyIO from 'fastify-socket.io';
import fastifyStatic from '@fastify/static';
import { Collection } from 'discord.js';
import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';
import path from 'path';
import fs from 'fs-extra';
import { ProtocolError } from '../structures/protocol/Protocol.js';

const fastifyLogger = rootLogger.child({ feature: features.api.fastify });
const socketLogger = rootLogger.child({ feature: features.api.socketio });


export default class MCLinkerAPI extends EventEmitter {

    /**
     * Error used when an awaited event does not arrive within the configured timeout.
     */
    static EventTimeoutError = class EventTimeoutError extends Error {

        /**
         * @param {string} event - The awaited event name.
         * @param {number} timeoutMs - The timeout in milliseconds.
         */
        constructor(event, timeoutMs) {
            super(`Timed out waiting for event "${event}" after ${timeoutMs}ms`);
            this.name = 'EventTimeoutError';
            this.event = event;
            this.timeoutMs = timeoutMs;
        }
    };

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

    /**
     * Pending websocket connection verifications keyed by guild ID.
     * Written by the Connect command (via broadcastEval to shard 0) and read/cleared here.
     * @type {Map<string, { code: string, shard: number, requiredRoleToJoin: ?object, displayIp: ?string, online: ?boolean }>}
     */
    wsVerification = new Map();

    /**
     * Secondary index mapping connection hashes to server IDs for O(1) lookup.
     * Maintained on connect/disconnect on shard 0.
     * @type {Map<string, string>}
     */
    hashIndex = new Map();

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
            // transports: ['websocket'], //TODO enable back after most people migrated
            logLevel: 'info',
        });

        this.fastify.register(fastifyStatic, {
            root: path.resolve('./socket.io-admin-ui'), // The path to the static files
            prefix: '/admin/', // optional: default '/'
            logLevel: 'info',
        });
        this.fastify.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });

        this.fastify.addHook('preHandler', (req, res, done) => {
            fastifyLogger.debug(`${req.method} request to ${req.url} from ${req.ip}: ${req.body}`);
            this.emitToAllShards(req.url, req);
            req._analyticsStartTime = Date.now();
            done();
        });

        this.fastify.addHook('onResponse', (req, res, done) => {
            const durationMs = Date.now() - (req._analyticsStartTime ?? Date.now());
            this.client.analytics.trackApiCall('rest', req.url, null, durationMs);
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
            fastifyLogger.debug(`Loaded REST route: ${route.endpoint}`);
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
            socketLogger.debug(`Loaded WS event: ${wsEvent.event}`);
        }
    }

    /**
     * Emits an event across all shards.
     * @param {string} event - The event to emit (the REST endpoint).
     * @param {import('fastify').FastifyRequest} req - The request object.
     */
    emitToAllShards(event, req) {
        const args = {
            method: req.method,
            body: req.body,
            headers: req.headers,
        };
        void this.client.broadcastEval((c, { event, args }) => c.api.emit(event, args), {
            context: {
                event,
                args,
            },
        });
    }

    /**
     * Core implementation: attaches a one-shot filtered listener on any EventEmitter-compatible object,
     * resolving when the resolver returns a non-undefined value, or rejecting on timeout.
     * The resolver should return `undefined` to keep waiting or any other value to resolve the promise.
     * @template T
     * @param {import('node:events').EventEmitter} emitter
     * @param {string} event
     * @param {number} timeoutMs
     * @param {(...args: any[]) => T|undefined} [resolver]
     * @returns {Promise<T>}
     */
    _waitForEmitterEvent(emitter, event, timeoutMs, resolver) {
        return new Promise((resolve, reject) => {
            let timeout;
            const cleanup = () => {
                clearTimeout(timeout);
                emitter.off(event, listener);
            };
            const listener = (...args) => {
                try {
                    const result = resolver ? resolver(...args) : args[0];
                    if(result === undefined) return;

                    cleanup();
                    resolve(result);
                }
                catch(err) {
                    cleanup();
                    reject(err);
                }
            };

            emitter.on(event, listener);
            timeout = setTimeout(() => {
                cleanup();
                reject(new MCLinkerAPI.EventTimeoutError(event, timeoutMs));
            }, timeoutMs);
        });
    }

    /**
     * Waits for a matching Socket.IO event on the given socket.
     * The resolver should return `undefined` to keep waiting or any other value to resolve the promise.
     * @template T
     * @param {import('socket.io').Socket} socket
     * @param {string} event
     * @param {number} timeoutMs
     * @param {(...args: any[]) => T|undefined} [resolver]
     * @returns {Promise<T>}
     */
    waitForWSEvent(socket, event, timeoutMs, resolver) {
        return this._waitForEmitterEvent(socket, event, timeoutMs, resolver);
    }

    /**
     * Waits for a matching event on the API's own EventEmitter.
     * The resolver should return `undefined` to keep waiting or any other value to resolve the promise.
     * @template T
     * @param {string} event
     * @param {number} timeoutMs
     * @param {(...args: any[]) => T|undefined} [resolver]
     * @returns {Promise<T>}
     */
    waitForAPIEvent(event, timeoutMs, resolver) {
        return this._waitForEmitterEvent(this, event, timeoutMs, resolver);
    }

    /**
     * Loads REST routes and WS event handlers. Called on all shards so that
     * handlers are available for cross-shard dispatch via broadcastEval.
     * @returns {Promise<void>}
     */
    async loadHandlers() {
        if(this.wsEvents.size > 0 || this.restRoutes.length > 0) return; // Already loaded
        await this._loadRoutes();
        await this._loadWSEvents();
    }

    async startServer() {
        await this.loadHandlers();

        for(const route of this.restRoutes) {
            if(route.customBot && process.env.CUSTOM_BOT !== 'true') continue;

            for(const method of route.methods) {
                this.fastify[method.toLowerCase()](route.endpoint, async (req, res) => {
                    if(route.customBot && process.env.COMMUNICATION_TOKEN !== req.headers['x-communication-token'])
                        return res.status(401).send({ message: 'Unauthorized' });

                    const response = await route[method.toLowerCase()](this.client, req, res);
                    if(!response) return; //Response already sent
                    fastifyLogger.debug(`Response for ${method} ${route.endpoint}: ${response?.toString()}`);
                    res.status(response?.status ?? 200).send(response?.body ?? {});
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
            readonly: true,
        });

        this.websocket.engine.on('connection_error', err => this.client.analytics.trackError('api_ws', 'engine.connection_error', null, null, err, null, socketLogger));

        this.fastify.listen({ port: process.env.BOT_PORT, host: '0.0.0.0' }, (err, address) => {
            if(err) {
                fastifyLogger.fatal(err, 'Error starting API server');
                process.exit(1);
            }
            fastifyLogger.info(`Server listening at ${address}`);
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
        socketLogger.debug(`Websocket connection to ${socket.nsp.name} from ${socket.handshake.address} with query ${JSON.stringify(socket.handshake.query)}`);

        // Skip middleware for admin-ui
        if(socket.nsp.name === '/admin') return next();

        // Basic auth for admin-ui
        if(socket.handshake.auth.username && socket.handshake.auth.password) return next();

        if(!socket.handshake.auth.token) {
            socketLogger.debug(`Connection from ${socket.handshake.address} provided invalid verification. Disconnecting socket.`);
            return next(new Error('Unauthorized'));
        }

        const token = socket.handshake.auth.token;
        const hash = createHash(token);

        // Find existing server connection via hash index (O(1)), falling back to cache scan for first reconnect after startup
        //TODO benchmark improvement, also maybe cache all server connections by hash up front
        const indexedId = this.hashIndex.get(hash);
        /** @type {?ServerConnection} */
        const server = indexedId ? this.client.serverConnections.cache.get(indexedId)
            : this.client.serverConnections.cache.find(s => s.hash === hash);

        if(server) {
            // Reconnection
            // Update data
            const oldSocket = server.protocol.socket;
            await server.edit({
                ip: socket.handshake.address,
                path: socket.handshake.query.path,
                online: server.forceOnlineMode ? server.online : socket.handshake.query.online === 'true',
                floodgatePrefix: socket.handshake.query.floodgatePrefix,
                version: socket.handshake.query.version ?? null,
                worldPath: socket.handshake.query.worldPath,
            });
            server.protocol.updateSocket(socket);

            this.addWebsocketListeners(socket, server, hash);

            // Disconnect the old socket after the new one is set up so its disconnect
            // event sees the replacement and skips the "server disconnected" logic
            if(oldSocket && oldSocket !== socket) oldSocket.disconnect(true);
            socketLogger.debug({ guildId: server.id }, `Successfully reconnected ${server.displayIp} to websocket`);

            // Sync all stat channels with fresh data from the plugin (on the guild's shard)
            void evalOnGuildShard(this.client, server.id, async (c, { serverId }) => {
                const server = c.serverConnections.cache.get(serverId);
                if(!server) return;
                const UpdateStatsChannel = c.api.wsEvents.get('update-stats-channels').constructor;
                await UpdateStatsChannel.syncAllStatChannels(server, c, true);
            }, { serverId: server.id });

            return next();
        }

        if(!server && socket.handshake.auth.code) {
            // New Connection
            const [id, userCode] = socket.handshake.auth.code?.split(':') ?? [];

            if(this.wsVerification.has(id)) {
                const {
                    code: serverCode,
                    shard,
                    requiredRoleToJoin,
                    displayIp,
                    online,
                } = this.wsVerification.get(id);
                try {
                    if(!serverCode || serverCode !== userCode) {
                        socketLogger.debug({ guildId: id }, `New Connection from ${socket.handshake.address} failed verification. Disconnecting socket.`);
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
                        version: socket.handshake.query.version ?? null,
                        worldPath: socket.handshake.query.worldPath,
                        protocol: 'websocket',
                        socket,
                        hash,
                        requiredRoleToJoin,
                        displayIp,
                    };

                    const oldServer = this.client.serverConnections.resolve(id);
                    if(oldServer) await this.client.serverConnections.disconnect(oldServer);

                    const server = await this.client.serverConnections.connect(serverConnectionData);
                    this.addWebsocketListeners(socket, id, hash);
                    socketLogger.debug({ guildId: server.id }, `Successfully connected ${server.displayIp} to websocket`);

                    void this.client.broadcastEval(
                        (c, { id }) => c.api.emit('connect-response', { id, responseType: 'success' }),
                        { context: { id }, shard },
                    );
                    next();
                }
                catch(err) {
                    this.client.analytics.trackError('api_ws', 'wsMiddleware', id, null, err, null, socketLogger.child({ guildId: id }, { track: false }));
                    void this.client.broadcastEval(
                        (c, { id, error }) => c.api.emit('connect-response', {
                            id,
                            responseType: 'error',
                            placeholders: { error_stack: error },
                        }),
                        { context: { id, error: err.stack }, shard },
                    );
                    next(new Error('Server Error'));
                }
            }
            else {
                socketLogger.debug({ guildId: id }, `Connection from ${socket.handshake.address} provided invalid verification. Disconnecting socket.`);
                next(new Error('Unauthorized'));
            }
        }
        else {
            socketLogger.debug('No server connection found. Disconnecting socket.');
            next(new Error('Unauthorized'));
        }
    }

    /**
     * Handles a new successful websocket connection (emitting event to acknowledge auth-success and send setup data).
     * @param {Socket} socket - The socket that connected.
     */
    async wsHandleConnection(socket) {
        const [id] = socket.handshake.auth.code?.split(':') ?? [];

        if(!this.wsVerification.has(id)) return; //Not a new connection

        const { requiredRoleToJoin } = this.wsVerification.get(id);
        this.wsVerification.delete(id);

        socket.emit('auth-success', { status: 'success', data: { requiredRoleToJoin } }); //Tell the plugin that the auth was successful
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
        socketLogger.debug(`Received event ${eventName} with data: ${data?.toString?.()}`);

        try {
            data = typeof data === 'string' ? JSON.parse(data) : {};
        }
        catch(err) {
            this.client.analytics.trackError('api_ws', eventName, null, null, err, { reason: 'invalid_json' }, socketLogger);
            return callback?.({ status: 'error', error: ProtocolError.INVALID_JSON });
        }

        const route = this.wsEvents.get(eventName);
        const rateLimiter = typeof route.rateLimiter === 'function' ? route.rateLimiter(data) : route.rateLimiter;
        try {
            await rateLimiter?.consume(socket.handshake.address);
        }
        catch(rejRes) {
            callback?.({ status: 'error', error: ProtocolError.RATE_LIMITED, data: { retryMs: rejRes.msBeforeNext } });
            return;
        }

        //Update server variable to ensure it wasn't disconnected in the meantime
        /** @type {?ServerConnection} */
        const serverId = this.hashIndex.get(hash);
        const server = serverId ? this.client.serverConnections.cache.get(serverId) : null;

        socketLogger.debug({ guildId: server?.id }, `Found server for event ${route.event}: ${server ? server.displayIp : 'none'}`);

        //If no connection on that guild, disconnect socket
        if(!server) return socket.disconnect();

        const startTime = Date.now();
        try {
            let response;
            if(route.dispatchToGuildShard) {
                response = await evalOnGuildShard(this.client, server.id, async (c, { eventName, data, serverId }) => {
                    const server = c.serverConnections.cache.get(serverId);
                    if(!server) return null;
                    return c.api.wsEvents.get(eventName).execute(data, server, c);
                }, { eventName, data, serverId: server.id });
            }
            else response = await route.execute(data, server, this.client);
            socketLogger.debug({ response, guildId: server.id }, `Response for event ${route.event}`);
            callback?.(response);
            this.client.analytics.trackApiCall('ws', eventName, server.id, Date.now() - startTime);
        }
        catch(err) {
            this.client.analytics.trackApiCall('ws', eventName, server.id, Date.now() - startTime, false);
            this.client.analytics.trackError('api_ws', eventName, server.id, null, err, null, socketLogger.child({ guildId: server.id }, { track: false }));
            callback?.({ status: 'error', error: ProtocolError.UNKNOWN });
        }
    }

    /**
     * Adds websocket listeners to the provided socket instance.
     * @param {Socket} socket - The socket to add the listeners to.
     * @param {ServerConnectionResolvable} serverResolvable - The server-connection related to the socket.
     * @param {string} hash - The hash to use for verifying server-connections.
     */
    addWebsocketListeners(socket, serverResolvable, hash) {
        this.hashIndex.set(hash, typeof serverResolvable === 'string' ? serverResolvable : serverResolvable.id);

        for(const route of this.wsEvents.values())
            socket.on(route.event, this.wsEventHandler.bind(this, socket, route.event, hash));

        socket.on('disconnect', reason => {
            socketLogger.debug({ guildId: typeof serverResolvable === 'string' ? serverResolvable : serverResolvable.id }, `Disconnected from ${socket.handshake.address} with reason: ${reason}`);

            /** @type {ServerConnection<WebSocketProtocol>} */
            const server = this.client.serverConnections.resolve(serverResolvable);

            // Skip if this socket has already been replaced by a reconnection
            if(!server || server.protocol.socket !== socket) return;

            this.hashIndex.delete(hash);

            if(!['server namespace disconnect', 'client namespace disconnect'].includes(reason)) {
                // Dispatch disconnect notification and stat channel sync to the guild's shard
                const embedJson = getEmbed(keys.api.plugin.warnings.server_disconnected).toJSON();
                void evalOnGuildShard(this.client, server.id, async (c, { serverId, embedJson }) => {
                    const server = c.serverConnections.cache.get(serverId);
                    if(!server) return;

                    // Send disconnect messages to chat channels
                    for(const chatChannel of server.chatChannels) {
                        const channel = await c.channels.fetch(chatChannel.id).catch(() => null);
                        if(channel) await channel.send({ embeds: [embedJson] }).catch(() => {});
                    }

                    // Update stat channels to reflect offline state
                    const UpdateStatsChannel = c.api.wsEvents.get('update-stats-channels').constructor;
                    await UpdateStatsChannel.syncAllStatChannels(server, c, false);
                }, { serverId: server.id, embedJson });
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
            socketLogger.fatal(res, 'Could not notify main bot of custom bot start');
            process.exit(1);
        }
        socketLogger.debug('Notified main bot of custom bot start');
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
        const connection = this.client.userConnections.findByUUID(uuid, server);
        if(!connection) return;
        uuid = connection.getUUID(server);

        const guild = await this.client.guilds.fetch(server.id);
        if(!guild) return;

        const role = await guild.roles.fetch(roleId);
        if(!role) return;

        const roleIndex = server.syncedRoles.findIndex(r => r.id === role.id);
        if(roleIndex === -1) return;
        const syncedRole = server.syncedRoles[roleIndex];

        // Always update the players list to reflect MC-side reality
        if(addOrRemove === 'add') syncedRole.players.push(uuid);
        else if(addOrRemove === 'remove') syncedRole.players.splice(syncedRole.players.indexOf(uuid), 1);
        await server.edit({});

        // Skip Discord role change if direction is to_minecraft (Discord→MC only)
        if(syncedRole.direction === 'to_minecraft') return;

        try {
            const member = await guild.members.fetch(connection.id);
            if(addOrRemove === 'add') await member.roles.add(role);
            else if(addOrRemove === 'remove') await member.roles.remove(role);
        }
        catch(err) {
            this.client.analytics.trackError('api_ws', 'updateSyncedRoleMember', server.id, connection.id, err, { roleId }, socketLogger.child({ guildId: server.id }, { track: false }));
        }
    }
}
