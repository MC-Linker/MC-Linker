const Protocol = require('./Protocol');
const fs = require('fs-extra');
const fetch = require('node-fetch');

class PluginProtocol extends Protocol {

    /**
     * @typedef {object} PluginProtocolData
     * @property {string} ip - The ip the plugin is listening on.
     * @property {number} port - The port the plugin is listening on.
     * @property {string} hash - The hash used to authenticate with the plugin.
     */

    /**
     * @typedef {array} PluginProtocolFetchData
     * @property {string} 0 - The http method to use.
     * @property {string} 1 - The route to fetch from.
     * @property {object|ReadableStream} 2 - The data to send with the request.
     * @property {Object.<string, string>} 3 - The queries to send with the request.
     */

    /**
     * @typedef {object} PluginResponse
     * @property {number} status - The status of the response.
     * @property {object|Buffer} data - The data of the response.
     */

    /**
     * API routes for the plugin protocol
     * @type {object}
     */
    pluginRoutes = {
        PutFile: fileStream => [
            'POST',
            '/file/put',
            fileStream,
        ],
        GetFile: path => [
            'POST',
            '/file/get',
            {},
            { path },
        ],
        ListFiles: folder => [
            'GET',
            '/file/list',
            {},
            { folder },
        ],
        Verify: () => [
            'GET',
            '/verify',
        ],
        Command: cmd => [
            'POST',
            '/command',
            {},
            { cmd },
        ],
        Chat: (msg, privateMode = false, username = '') => [
            'POST',
            '/chat',
            { msg, private: privateMode, username },
        ],
        Connect: () => [
            'POST',
            '/connect',
            {
                ip: this.ip,
                guild: this.id,
            },
        ],
        Disconnect: () => [
            'GET',
            '/connect',
        ],
        /**
         * @param {ChatChannelData} channel - The chat channel to add.
         * @returns {PluginProtocolFetchData}
         */
        AddChannel: channel => [
            'POST',
            '/channel/add',
            channel,
        ],
        /**
         * @param {ChatChannelData} channel - The chat channel to remove.
         * @returns {PluginProtocolFetchData}
         */
        RemoveChannel: channel => [
            'POST',
            '/channel/remove',
            channel,
        ],
        ListOnlinePlayers: () => [
            '/players',
        ],
    };

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     * @param {PluginProtocolData} data - The data for the protocol.
     */
    constructor(client, data) {
        super(client);

        this._patch(data);
    }


    _patch(data) {

        /**
         * The ip the plugin is listening on.
         * @type {string}
         */
        this.ip = data.ip ?? this.ip;

        /**
         * The port the plugin is listening on.
         * @type {number}
         */
        this.port = data.port ?? this.port;

        /**
         * The hash used to authenticate with the plugin.
         * @type {string}
         */
        this.hash = data.hash ?? this.hash;
    }

    /**
     * @inheritDoc
     */
    async connect() {
        const response = await this._fetch(...this.pluginRoutes.Connect());
        if(response) return response.ok;
        return false;
    }

    /**
     * Disconnects from the plugin.
     * @returns {Promise<?PluginResponse>}
     */
    async disconnect() {
        const response = await this._fetch(...this.pluginRoutes.Disconnect());
        return await fetchToPluginResponse(response);
    }

    /**
     * @inheritDoc
     * @returns {Promise<?PluginResponse>}
     */
    async get(getPath, putPath) {
        const response = await this._fetch(...this.pluginRoutes.GetFile(getPath));
        if(!response.ok) return fetchToPluginResponse(response);

        try {
            await response.body.pipeTo(fs.createWriteStream(putPath));
            return { status: response.status, data: await fs.readFile(putPath) };
        } catch(err) {
            return null;
        }
    }

    /**
     * @inheritDoc
     * @returns {Promise<?PluginResponse>}
     */
    async put(getPath, putPath) {
        try {
            const response = await this._fetch(...this.pluginRoutes.PutFile(fs.createReadStream(getPath)));
            return fetchToPluginResponse(response);
        } catch(err) {
            return null;
        }
    }

    /**
     * @inheritDoc
     * @returns {Promise<?PluginResponse>}
     */
    async list(folder) {
        try {
            const response = await this._fetch(...this.pluginRoutes.ListFiles(folder));
            return fetchToPluginResponse(response);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Sends a public chat message to the server.
     * @param {string} message - The message to send.
     * @returns {Promise<?PluginResponse>}
     */
    async chat(message) {
        try {
            const response = await this._fetch(...this.pluginRoutes.Chat(message));
            return fetchToPluginResponse(response);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Sends a private chat message to a player on the server.
     * @param {string} message - The message to send.
     * @param {string} username - The username of the player to send the message to.
     * @returns {Promise<?PluginResponse>} - Whether the chat was successful.
     */
    async chatPrivate(message, username) {
        const response = await this._fetch(...this.pluginRoutes.Chat(message, true, username));
        return fetchToPluginResponse(response);
    }

    /**
     * Adds a chat channel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {Promise<?PluginResponse>} - Whether the chat channel addition was successful.
     */
    async addChatChannel(channel) {
        const response = await this._fetch(...this.pluginRoutes.AddChannel(channel));
        return fetchToPluginResponse(response);
    }

    /**
     * Removes a chat channel from the server.
     * @param {ChatChannelData} channel - The chat channel to remove.
     * @returns {Promise<?PluginResponse>} - Whether the chat channel removal was successful.
     */
    async removeChatChannel(channel) {
        const response = await this._fetch(...this.pluginRoutes.AddChannel(channel));
        return fetchToPluginResponse(response);
    }

    /**
     * Executes a command on the server.
     * @param {ChatChannelData} command - The command to execute.
     * @returns {Promise<?PluginResponse>} - The response of the command.
     */
    async execute(command) {
        const response = await this._fetch(...this.pluginRoutes.Command(command));
        return fetchToPluginResponse(response);
    }

    /**
     * Gets a list of online players on the server.
     * @returns {Promise<?PluginResponse>} - Whether the chat channel addition was successful.
     */
    async getOnlinePlayers() {
        const response = await this._fetch(...this.pluginRoutes.ListOnlinePlayers());
        return fetchToPluginResponse(response);
    }

    /**
     * Fetches data from the plugin.
     * @param {string} method - The http method to use.
     * @param {string} route - The route to fetch from.
     * @param {object|ReadStream} data - The data to send with the request.
     * @param {Object.<string, string>} queries - The queries to send with the request.
     * @returns {Promise<?Response>} - The response of the request.
     */
    async _fetch(method, route, data = {}, queries = {}) {
        let url = new URL(`http://${this.ip}:${this.port}${route}`);
        for(const key in queries) {
            url.searchParams.append(key, queries[key]);
        }

        try {
            return await fetch(url.toString(), {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${this.hash}`,
                },
                body: typeof data === 'object' ? JSON.stringify(data) : data,
            });
        } catch(err) {
            return null;
        }
    }
}

/**
 * Converts a fetch response object to a plugin response object.
 * @param response - The fetch response object to convert.
 * @returns {Promise<?PluginResponse>} - The plugin response object.
 */
async function fetchToPluginResponse(response) {
    if(!response) return null;

    return {
        status: response.status,
        json: await response.json(),
    };
}

module.exports = PluginProtocol;
