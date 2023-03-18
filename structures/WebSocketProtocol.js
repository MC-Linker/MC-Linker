import Protocol from './Protocol.js';
import fs from 'fs-extra';

export default class WebSocketProtocol extends Protocol {

    /**
     * @typedef {object} WebSocketProtocolData
     * @property {string} ip - The ip the websocket client is listening on.
     * @property {string} id - The guild id this protocol is for.
     * @property {import('socket.io').Socket} [socket] - The connected WebSocket of this protocol.
     */

    /**
     * The connected WebSocket of this protocol.
     * @type {?import('socket.io').Socket}
     */
    socket;

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     * @param {WebSocketProtocolData} data - The data for the protocol.
     */
    constructor(client, data) {
        super(client);

        this._patch(data);
    }

    _patch(data) {

        /**
         * The guild id this protocol is for.
         */
        this.id = data.id ?? this.id;

        /**
         * The ip the websocket client is listening on.
         * @type {string}
         */
        this.ip = data.ip ?? this.ip;

        /**
         * The connected WebSocket of this protocol.
         * @type {?import('socket.io').Socket}
         */
        this.socket = data.socket ?? this.socket;
    }

    /**
     * Disconnects from the plugin.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async disconnect() {
        return await this.client.shard.broadcastEval(async (c, { id }) => {
            /** @type {WebSocketProtocol} */
            const protocol = c.serverConnections.cache.get(id).protocol;
            if(!protocol.socket) return { status: 200 };
            await protocol.socket.disconnect(true);
            return { status: 200 };
        }, { context: { id: this.id }, shard: 0 });
    }

    /**
     * @inheritDoc
     */
    async get(getPath, putPath) {
        const response = await this._sendRaw('get-file', { path: getPath });
        if(!response) return null;
        if(response.type !== 'Buffer') return { status: response.status, data: null };

        await fs.outputFile(putPath, Buffer.from(response.data));
        return { status: 200, data: await fs.readFile(putPath) };
    }

    /**
     * @inheritDoc
     */
    async put(getPath, putPath) {
        return await this._sendRaw('put-file', { path: encodeURIComponent(putPath) }, await fs.readFile(getPath));
    }

    /**
     * @inheritDoc
     */
    async list(folder) {
        return await this._sendRaw('list-file', { folder });
    }

    /**
     * Sends a public chat message to the server.
     * @param {string} message - The content of the message to send.
     * @param {string} username - The user who sent the message.
     * @param {?string=null} replyMessage - THe content of the message that was replied to.
     * @param {?string=null} replyUsername - The username of the user who sent the message that was replied to.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async chat(message, username, replyMessage = null, replyUsername = null) {
        const data = {
            msg: message,
            username,
            private: false,
        };
        if(replyMessage && replyUsername) {
            data.reply_msg = replyMessage;
            data.reply_username = replyUsername;
        }

        return await this._sendRaw('chat', data);
    }

    /**
     * Sends a private chat message to a player on the server.
     * @param {string} message - The message to send.
     * @param {string} username - The user who sent the message.
     * @param {string} target - The username of the player to send the message to.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async chatPrivate(message, username, target) {
        const data = { msg: message, username, target, private: true };
        return await this._sendRaw('chat', data);
    }

    /**
     * Adds a chat channel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addChatChannel(channel) {
        return await this._sendRaw('add-channel', channel);
    }

    /**
     * Removes a stats channel from the server.
     * @param {ChatChannelData} channel - The stats channel to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeChatChannel(channel) {
        return await this._sendRaw('remove-stats-channel', channel);
    }

    /**
     * Adds a stats channel to the server.
     * @param {StatsChannelData} channel - The stats channel to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addStatsChannel(channel) {
        return await this._sendRaw('add-stats-channel', channel);
    }

    /**
     * Removes a chat channel from the server.
     * @param {StatsChannelData} channel - The chat channel to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeStatsChannel(channel) {
        return await this._sendRaw('remove-stats-channel', channel);
    }

    /**
     * Executes a command on the server.
     * @param {string} command - The command to execute.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async execute(command) {
        return await this._sendRaw('command', { cmd: encodeURIComponent(command) });
    }

    /**
     * Gets a list of online players on the server.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async getOnlinePlayers() {
        return await this._sendRaw('list-players', {});
    }

    /**
     * Sends a verification request to the server. Users can verify using `/verify <code>`.
     * @param {string} code - The verification code to send.
     * @param {string} uuid - The uuid of the user that sent the request.
     * @returns {Promise<?ProtocolResponse>} - The response from the websocket client.
     */
    async verifyUser(code, uuid) {
        return await this._sendRaw('verify-user', { code, uuid });
    }

    /**
     * Sends a raw event to the websocket client.
     * @param {string} name - The name of the event.
     * @param {...Serializable} data - The data to send.
     * @returns {Promise<?ProtocolResponse>}
     * @private
     */
    async _sendRaw(name, ...data) {
        // Broadcast the event to shard 0 where the websocket server is running
        return await this.client.shard.broadcastEval(async (c, { id, name, data }) => {
            return await new Promise(resolve => {
                /** @type {WebSocketProtocol} */
                const protocol = c.serverConnections.cache.get(id).protocol;
                if(!protocol.socket) return resolve(null);
                protocol.socket.timeout(5000).emit(name, ...data, (err, response) => {
                    if(err) return resolve(null);
                    if(typeof response === 'string') resolve(JSON.parse(response));
                    else resolve(response);
                });
            });
        }, { context: { id: this.id, name, data }, shard: 0 });
    }

    /**
     * Updates the connected websocket client of this protocol.
     * @param {import('socket.io').Socket} socket - The new socket to use.
     */
    updateSocket(socket) {
        this.socket = socket;
    }
}
