const Protocol = require('./Protocol');
const fs = require('fs-extra');
const fetch = require('node-fetch');


/**
 * API routes for the plugin protocol
 * @type {object}
 */
const PluginRoutes = {
    /**
     * Uploads a file to the server.
     * @param {ReadStream} fileStream - The file to upload.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    PutFile: fileStream => [
        'POST',
        '/file/put',
        fileStream,
    ],
    /**
     * Downloads a file from the server.
     * @param {string} path - The remote path to download the file from.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    GetFile: path => [
        'POST',
        '/file/get',
        {},
        { path },
    ],
    /**
     * Lists the files in a folder on the server.
     * @param {string} folder - The folder to list.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    ListFiles: folder => [
        'GET',
        '/file/list',
        {},
        { folder },
    ],
    /**
     * Generates a verification code and displays it on the server.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Verify: () => [
        'GET',
        '/verify',
    ],
    /**
     * Executes a command on the server.
     * @param {string} cmd - The command to execute.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Command: cmd => [
        'POST',
        '/command',
        {},
        { cmd },
    ],
    /**
     * Sends a chat message to the server or a user.
     * @param {string} msg - The message to send.
     * @param {boolean=false} privateMode - Whether to send the message privately.
     * @param {string=''} username - The user to send the message to.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Chat: (msg, privateMode = false, username = '') => [
        'POST',
        '/chat',
        { msg, private: privateMode, username },
    ],
    /**
     * Connects to the server.
     * @param {string} ip - The IP address of the server.
     * @param {number} guildId - The Id of the guild that tries to connect.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Connect: (ip, guildId) => [
        'POST',
        '/connect',
        { ip, guild: guildId },
    ],
    /**
     * Disconnects from the server.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Disconnect: () => [
        'GET',
        '/connect',
    ],
    /**
     * Adds a chatchannel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {PluginProtocolFetchData}
     */
    AddChannel: channel => [
        'POST',
        '/channel/add',
        channel,
    ],
    /**
     * Removes a chatchannel from the server.
     * @param {ChatChannelData} channel - The chat channel to remove.
     * @returns {PluginProtocolFetchData}
     */
    RemoveChannel: channel => [
        'POST',
        '/channel/remove',
        channel,
    ],
    /**
     * Lists the online players on the server.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    ListOnlinePlayers: () => [
        '/players',
    ],
};


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
     * @property {object|ReadableStream} 2 - The body to send with the request.
     * @property {Object.<string, string>} 3 - The queries to send with the request.
     */

    /**
     * @typedef {object} PluginResponse
     * @property {number} status - The status of the response.
     * @property {object|Buffer} data - The data of the response.
     */

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
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async connect() {
        const response = await this._fetch(...PluginRoutes.Connect(this.ip, this.id));
        return await fetchToPluginResponse(response);
    }

    /**
     * Disconnects from the plugin.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async disconnect() {
        const response = await this._fetch(...PluginRoutes.Disconnect());
        return await fetchToPluginResponse(response);
    }

    /**
     * @inheritDoc
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async get(getPath, putPath) {
        const response = await this._fetch(...PluginRoutes.GetFile(getPath));
        if(!response?.ok) return fetchToPluginResponse(response);

        try {
            await response.body.pipeTo(fs.createWriteStream(putPath));
            return { status: response.status, data: await fs.readFile(putPath) };
        } catch(err) {
            return null;
        }
    }

    /**
     * @inheritDoc
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async put(getPath, putPath) {
        try {
            const response = await this._fetch(...PluginRoutes.PutFile(fs.createReadStream(getPath)));
            return fetchToPluginResponse(response);
        } catch(err) {
            return null;
        }
    }

    /**
     * @inheritDoc
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async list(folder) {
        try {
            const response = await this._fetch(...PluginRoutes.ListFiles(folder));
            return fetchToPluginResponse(response);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Sends a public chat message to the server.
     * @param {string} message - The message to send.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async chat(message) {
        try {
            const response = await this._fetch(...PluginRoutes.Chat(message));
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
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async chatPrivate(message, username) {
        const response = await this._fetch(...PluginRoutes.Chat(message, true, username));
        return fetchToPluginResponse(response);
    }

    /**
     * Adds a chat channel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async addChatChannel(channel) {
        const response = await this._fetch(...PluginRoutes.AddChannel(channel));
        return fetchToPluginResponse(response);
    }

    /**
     * Removes a chat channel from the server.
     * @param {ChatChannelData} channel - The chat channel to remove.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async removeChatChannel(channel) {
        const response = await this._fetch(...PluginRoutes.AddChannel(channel));
        return fetchToPluginResponse(response);
    }

    /**
     * Executes a command on the server.
     * @param {string} command - The command to execute.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async execute(command) {
        const response = await this._fetch(...PluginRoutes.Command(command));
        return fetchToPluginResponse(response);
    }

    /**
     * Gets a list of online players on the server.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async getOnlinePlayers() {
        const response = await this._fetch(...PluginRoutes.ListOnlinePlayers());
        return fetchToPluginResponse(response);
    }

    /**
     * Fetches data from the plugin.
     * @param {string} method - The http method to use.
     * @param {string} route - The route to fetch from.
     * @param {object|ReadStream} data - The data to send with the request.
     * @param {Object.<string, string>} queries - The queries to send with the request.
     * @returns {Promise<?Response>} - The response of the request.
     * @private
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
                    'Authorization': `Basic ${this.hash}`, //TODO make Bearer
                },
                body: typeof data === 'object' ? JSON.stringify(data) : data,
            });
        } catch(err) {
            return null;
        }
    }

    /**
     * @inheritDoc
     * @returns {Promise<boolean>} - The response from the plugin.
     */
    static async testConnection(data) {
        const response = await this._fetch(...PluginRoutes.Connect(this.ip, this.id)); // TODO
        if(response) return response.ok;
        return false;
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
