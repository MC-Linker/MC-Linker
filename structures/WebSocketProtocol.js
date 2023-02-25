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
        const response = await this.client.shard.broadcastEval(async (c, { id }) => {
            /** @type {WebSocketProtocol} */
            const protocol = c.serverConnections.cache.get(id).protocol;
            console.log(protocol);
            if(!protocol.socket) return { status: 200 };
            await protocol.socket.disconnect(true);
            return { status: 200 };
        }, { context: { id: this.id }, shard: 0 });
        console.log(response);
        return response;
    }

    /**
     * @inheritDoc
     */
    async get(getPath, putPath) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            await fs.ensureFile(putPath);

            this.socket.timeout(5000).emit('get-file', { path: getPath }, async (err, response) => {
                if(err || !response) return resolve(null);
                if(!(response instanceof Buffer)) return resolve({ status: JSON.parse(response).status });

                await fs.writeFile(putPath, response);
                resolve({
                    status: 200,
                    data: await fs.readFile(putPath),
                });
            });
        });
    }

    /**
     * @inheritDoc
     */
    async put(getPath, putPath) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('put-file', { path: encodeURIComponent(putPath) }, await fs.readFile(getPath), (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * @inheritDoc
     */
    async list(folder) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('list-file', { folder }, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
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
        if(!this.socket) return null;
        return new Promise(async resolve => {
            const data = {
                msg: message,
                username,
                private: false,
            };
            if(replyMessage && replyUsername) {
                data.reply_msg = replyMessage;
                data.reply_username = replyUsername;
            }

            this.socket.timeout(5000).emit('chat', data, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * Sends a private chat message to a player on the server.
     * @param {string} message - The message to send.
     * @param {string} username - The user who sent the message.
     * @param {string} target - The username of the player to send the message to.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async chatPrivate(message, username, target) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            const data = { msg: message, username, target, private: true };
            this.socket.timeout(5000).emit('chat', data, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * Adds a chat channel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addChatChannel(channel) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('add-channel', channel, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * Removes a chat channel from the server.
     * @param {ChatChannelData} channel - The chat channel to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeChatChannel(channel) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('remove-channel', channel, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * Executes a command on the server.
     * @param {string} command - The command to execute.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async execute(command) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('command', { cmd: encodeURIComponent(command) }, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * Gets a list of online players on the server.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async getOnlinePlayers() {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('list-players', {}, (err, response) => {
                if(err) return resolve(null);
                resolve(JSON.parse(response));
            });
        });
    }

    /**
     * Sends a verification request to the server. Users can verify using `/verify <code>`.
     * @param {string} code - The verification code to send.
     * @param {string} uuid - The uuid of the user that sent the request.
     * @returns {Promise<?ProtocolResponse>} - The response from the websocket client.
     */
    async verifyUser(code, uuid) {
        if(!this.socket) return null;
        return new Promise(async resolve => {
            this.socket.timeout(5000).emit('verify-user', { code, uuid }, (err, response) => {
                if(err) return resolve(null);
                resolve(response);
            });
        });
    }

    /**
     * Updates the connected websocket client of this protocol.
     * @param {import('socket.io').Socket} socket - The new socket to use.
     */
    updateSocket(socket) {
        this.socket = socket;
    }
}
