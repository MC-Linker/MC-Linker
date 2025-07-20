import Event from '../structures/Event.js';

/**
 * Handles the Discord ready event for the MC-Linker bot.
 * Logs the bot's login success and initializes various components.
 */
export default class ApiReady extends Event {
    constructor() {
        super({
            name: 'apiReady',
            shard: 0,
        });
    }

    async execute(client, id) {
        client.api.websocket.on('connection', async socket => {
            const [id, userCode] = socket.handshake.auth.code?.split(':') ?? [];

            /** @type {Connect} */
            const connectCommand = client.commands.get('connect');
            const wsVerification = connectCommand.wsVerification;
            if(!wsVerification.has(id)) return;

            const {
                code: serverCode,
                shard,
                requiredRoleToJoin,
                displayIp,
                online,
            } = wsVerification.get(id) ?? {};
            try {
                if(!serverCode || serverCode !== userCode) return socket.disconnect(true);

                wsVerification.delete(id);
                socket.emit('auth-success', { requiredRoleToJoin }); //Tell the plugin that the auth was successful

                const hash = client.utils.createHash(socket.handshake.auth.token);
                /** @type {WebSocketServerConnectionData} */
                const serverConnectionData = {
                    id,
                    ip: socket.handshake.address,
                    path: socket.handshake.query.path,
                    chatChannels: [],
                    statChannels: [],
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

                await connectCommand.disconnectOldServer(client, id);
                await client.serverConnections.connect(serverConnectionData);

                client.api.addWebsocketListeners(socket, id, hash);

                await client.shard.broadcastEval(
                    (c, { id }) => c.emit('editConnectResponse', id, 'success'),
                    { context: { id }, shard },
                );
            }
            catch(err) {
                await client.shard.broadcastEval(
                    (c, { id, error }) => c.emit('editConnectResponse', id, 'error', { error_stack: error }),
                    { context: { id, error: err.stack }, shard },
                );
                socket.disconnect(true);
            }
        });
    }
}