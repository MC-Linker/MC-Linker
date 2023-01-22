import Protocol from './Protocol.js';
import fs from 'fs-extra';
import { Readable } from 'stream';

/**
 * API routes for the plugin protocol
 * @type {object}
 */
const PluginRoutes = {
    /**
     * Base URL
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Base: () => [
        'GET',
        '/',
    ],
    /**
     * Uploads a file to the server.
     * @param {ReadStream} fileStream - The file to upload.
     * @param {string} path - The remote path to upload the file to.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    PutFile: (fileStream, path) => [
        'PUT',
        '/file/put',
        fileStream,
        { path },
    ],
    /**
     * Downloads a file from the server.
     * @param {string} path - The remote path to download the file from.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    GetFile: path => [
        'GET',
        '/file/get',
        {},
        { path },
    ],
    /**
     * Generates a verification code and displays it on the server.
     * @param {string} id - The guild id that is requesting the code.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    VerifyGuild: id => [
        'GET',
        '/verify/guild',
        {},
        { id },
    ],
    /**
     * Sends a verification request to the server. Users can verify using `/verify <code>`.
     * @param {string} code - The verification code to send to the server.
     * @param {string} uuid - The uuid of the user that is verifying.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    VerifyUser: (code, uuid) => [
        'GET',
        '/verify/user',
        {},
        { code, uuid },
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
     * Executes a command on the server.
     * @param {string} cmd - The command to execute.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Command: cmd => [
        'GET',
        '/command',
        {},
        { cmd },
    ],
    /**
     * Sends a chat message to the server.
     * @param {string} msg - The message to send.
     * @param {string} username - The user to send the message to.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Chat: (msg, username) => [
        'POST',
        '/chat',
        { msg, private: false, username },
    ],
    /**
     * Sends a private chat message to a user.
     * @param {string} msg - The message to send.
     * @param {string} username - The user who sent the message.
     * @param {string} target - The user to send the message to.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    PrivateChat: (msg, username, target) => [
        'POST',
        '/chat',
        { msg, private: true, target, username },
    ],
    /**
     * Sends a chat message that references a reply to the server.
     * @param {string} msg - The message to send.
     * @param {string} username - The user to send the message to.
     * @param {string} replyMsg - The message that was replied to.
     * @param {string} replyUsername - The user that sent the message that was replied to.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    ReplyChat: (msg, username, replyMsg, replyUsername) => [
        'POST',
        '/chat',
        { msg, private: false, username, reply_msg: replyMsg, reply_username: replyUsername },
    ],
    /**
     * Connects to the server.
     * @param {string} ip - The IP address of the server.
     * @param {number} guildId - The Id of the guild that tries to connect.
     * @param {string} verifyCode - The verification code to use.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Connect: (ip, guildId, verifyCode) => [
        'POST',
        '/connect',
        { ip, id: guildId, code: verifyCode },
        {},
    ],
    /**
     * Disconnects from the server.
     * @returns {PluginProtocolFetchData} - The data to send to the plugin.
     */
    Disconnect: () => [
        'GET',
        '/disconnect',
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
        'GET',
        '/players',
    ],
};


export default class HttpProtocol extends Protocol {

    /**
     * @typedef {object} PluginProtocolData
     * @property {string} ip - The ip the plugin is listening on.
     * @property {number} port - The port the plugin is listening on.
     * @property {string} token - The token used to authenticate with the plugin.
     * @property {string} id - The guild id this protocol is for.
     */

    /**
     * @typedef {array} PluginProtocolFetchData
     * @property {string} 0 - The http method to use.
     * @property {string} 1 - The route to fetch from.
     * @property {object|ReadableStream} 2 - The body to send with the request.
     * @property {Object.<string, string>} 3 - The queries to send with the request.
     * @property {string} 4 - The authorization headers to send with the request.
     */

    /**
     * Creates a new http protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     * @param {PluginProtocolData} data - The data for the protocol.
     */
    constructor(client, data) {
        super(client);

        this._patch(data);
    }

    /**
     * Fetches a url with the given data.
     * @param {string} method - The http method to use.
     * @param {URL} url - The url to fetch.
     * @param {string} hash - The hash to use for authentication.
     * @param {?object} [body={}] - The body to send with the request.
     * @param {?string} [authorization=null] - Additional authorization headers to send with the request.
     * @returns {Promise<null|Response>} - The response from the server.
     * @private
     */
    static async fetch(method, url, hash, body = {}, authorization = null) {
        try {
            let authorizationString = `Bearer ${hash}`;
            if(authorization) authorizationString += `, ${authorization}`;

            return await fetch(url.toString(), {
                method,
                headers: {
                    'Authorization': authorizationString,
                },
                body: Object.keys(body ?? {}).length === 0 ? null : JSON.stringify(body),
            });
        }
        catch(_) {
            return null;
        }
    }

    /**
     * @inheritDoc
     */
    static async testConnection(data) {
        const url = new URL(PluginRoutes.Base()[1], `http://${data.ip}:${data.port}`);
        const response = await HttpProtocol.fetch(PluginRoutes.Base()[0], url, data.token);
        if(response) return response.ok;
        return false;
    }

    _patch(data) {

        /**
         * The guild id this protocol is for.
         */
        this.id = data.id ?? this.id;

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
        this.token = data.token ?? this.token;
    }

    /**
     * Generates a verification code and displays it on the server.
     * @returns {Promise<ProtocolResponse>} - The response from the plugin.
     */
    async verifyGuild() {
        const response = await this._fetch(...PluginRoutes.VerifyGuild(this.id));
        return await fetchToProtocolResponse(response);
    }

    /**
     * Sends a verification request to the server. Users can verify using `/verify <code>`.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async verifyUser(code, uuid) {
        const response = await this._fetch(...PluginRoutes.VerifyUser(code, uuid));
        return fetchToProtocolResponse(response);
    }

    /**
     * Tests the connection to the server with the given credentials.
     * @param {string} verifyCode - The verification code to use.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async connect(verifyCode) {
        const response = await this._fetch(...PluginRoutes.Connect(`${this.ip}:${this.port}`, this.id, verifyCode));
        return await fetchToProtocolResponse(response);
    }

    /**
     * Disconnects from the plugin.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async disconnect() {
        const response = await this._fetch(...PluginRoutes.Disconnect());
        return await fetchToProtocolResponse(response);
    }

    /**
     * @inheritDoc
     */
    async get(getPath, putPath) {
        return new Promise(async resolve => {
            try {
                await fs.ensureFile(putPath);

                const response = await this._fetch(...PluginRoutes.GetFile(getPath));
                if(!response?.ok) return resolve(fetchToProtocolResponse(response));

                const writeStream = fs.createWriteStream(putPath);
                await Readable.fromWeb(response.body).pipe(writeStream);
                writeStream.on('finish', async () => resolve({
                    status: response.status,
                    data: await fs.readFile(putPath),
                }));
                writeStream.on('error', () => resolve(null));
            }
            catch(_) {
                resolve(null);
            }
        });
    }

    /**
     * @inheritDoc
     */
    async put(getPath, putPath) {
        try {
            const response = await this._fetch(...PluginRoutes.PutFile(fs.createReadStream(getPath), putPath));
            return fetchToProtocolResponse(response);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * @inheritDoc
     */
    async list(folder) {
        try {
            const response = await this._fetch(...PluginRoutes.ListFiles(folder));
            return fetchToProtocolResponse(response);
        }
        catch(err) {
            return null;
        }
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
        try {
            const route = replyMessage ? PluginRoutes.ReplyChat(message, username, replyMessage, replyUsername) : PluginRoutes.Chat(message, username);
            const response = await this._fetch(...route);
            return fetchToProtocolResponse(response);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Sends a private chat message to a player on the server.
     * @param {string} message - The message to send.
     * @param {string} username - The user who sent the message.
     * @param {string} target - The username of the player to send the message to.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async chatPrivate(message, username, target) {
        const response = await this._fetch(...PluginRoutes.PrivateChat(message, username, target));
        return fetchToProtocolResponse(response);
    }

    /**
     * Adds a chat channel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addChatChannel(channel) {
        const response = await this._fetch(...PluginRoutes.AddChannel(channel));
        return fetchToProtocolResponse(response);
    }

    /**
     * Removes a chat channel from the server.
     * @param {ChatChannelData} channel - The chat channel to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeChatChannel(channel) {
        const response = await this._fetch(...PluginRoutes.RemoveChannel(channel));
        return fetchToProtocolResponse(response);
    }

    /**
     * Executes a command on the server.
     * @param {string} command - The command to execute.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async execute(command) {
        const response = await this._fetch(...PluginRoutes.Command(command));
        return fetchToProtocolResponse(response);
    }

    /**
     * Gets a list of online players on the server.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async getOnlinePlayers() {
        const response = await this._fetch(...PluginRoutes.ListOnlinePlayers());
        return fetchToProtocolResponse(response);
    }

    /**
     * Fetches data from the plugin.
     * @param {string} method - The http method to use.
     * @param {string} route - The route to fetch from.
     * @param {object|ReadStream} [body={}] - The data to send with the request.
     * @param {Object.<string, string>} [queries={}] - The queries to send with the request.
     * @param {?string} [authorization=null] - Additional authorization headers to send with the request.
     * @returns {Promise<?Response>} - The response of the request.
     * @private
     */
    async _fetch(method, route, body = {}, queries = {}, authorization = null) {
        try {
            const url = new URL(`http://${this.ip}:${this.port}`);
            url.pathname = route;
            for(const key in queries) {
                url.searchParams.append(key, queries[key]);
            }

            return await HttpProtocol.fetch(method, url, this.token, body, authorization);
        }
        catch(_) {
            return null;
        }
    }

}

/**
 * Converts a fetch response object to a plugin response object.
 * @param {Response} response - The fetch response object to convert.
 * @returns {Promise<?ProtocolResponse>} - The plugin response object.
 */
async function fetchToProtocolResponse(response) {
    if(!response) return null;

    return {
        status: response.status,
        data: await response.json(),
    };
}
