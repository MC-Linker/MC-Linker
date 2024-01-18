import Protocol from './Protocol.js';
import fs from 'fs-extra';
import { Readable } from 'stream';

/**
 * API routes for the http protocol
 * @type {object}
 */
const PluginRoutes = {
    /**
     * Base URL
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    Base: () => [
        'GET',
        '/',
    ],
    /**
     * Uploads a file to the server.
     * @param {ReadStream} fileStream - The file to upload.
     * @param {string} path - The remote path to upload the file to.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    Command: cmd => [
        'GET',
        '/command',
        {},
        { cmd },
    ],
    /**
     * Gets the live snbt-data of a player. The Player has to be online for this endpoint to work.
     * @param {string} uuid - The uuid of the player to get the snbt-data of.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    GetPlayerNbt: uuid => [
        'GET',
        '/player/nbt',
        {},
        { uuid },
    ],
    /**
     * Sends a chat message to the server.
     * @param {string} msg - The message to send.
     * @param {string} username - The user to send the message to.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
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
     * @param {?RequiredRoleToJoinData} requiredRoleToJoin - The data for the required roles to join the server.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    Connect: (ip, guildId, verifyCode, requiredRoleToJoin) => [
        'POST',
        '/connect',
        { ip, id: guildId, code: verifyCode, requiredRoleToJoin },
        {},
    ],
    /**
     * Disconnects from the server.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    Disconnect: () => [
        'GET',
        '/disconnect',
    ],
    /**
     * Adds a chatchannel to the server.
     * @param {ChatChannelData} channel - The chatchannel to add.
     * @returns {HttpProtocolFetchData}
     */
    AddChannel: channel => [
        'POST',
        '/channel/add',
        channel,
    ],
    /**
     * Removes a chatchannel from the server.
     * @param {ChatChannelData} channel - The chatchannel to remove.
     * @returns {HttpProtocolFetchData}
     */
    RemoveChannel: channel => [
        'POST',
        '/channel/remove',
        channel,
    ],
    /**
     * Adds a stats-channel to the server.
     * @param {StatsChannelData} channel - The stats-channel to add.
     * @returns {HttpProtocolFetchData}
     */
    AddStatsChannel: channel => [
        'POST',
        '/stats-channel/add',
        channel,
    ],
    /**
     * Removes a stats-channel from the server.
     * @param {StatsChannelData} channel - The stats-channel to remove.
     * @returns {HttpProtocolFetchData}
     */
    RemoveStatsChannel: channel => [
        'POST',
        '/stats-channel/remove',
        channel,
    ],
    /**
     * Adds a synced-role to the server.
     * @param {SyncedRoleData & { override: 'minecraft'|'discord'|null }} role - The synced-role to add.
     * @returns {HttpProtocolFetchData}
     */
    AddSyncedRole: role => [
        'POST',
        '/synced-role/add',
        role,
    ],
    /**
     * Removes a synced-role from the server.
     * @param {SyncedRoleData} role - The synced-role to remove.
     * @returns {HttpProtocolFetchData}
     */
    RemoveSyncedRole: role => [
        'POST',
        '/synced-role/remove',
        role,
    ],
    /**
     * Removes a member from a synced-role.
     * @param {SyncedRoleData} role - The synced role to remove the member from.
     * @param {string} uuid - The UUID of the member to remove.
     * @returns {HttpProtocolFetchData}
     */
    RemoveSyncedRoleMember: (role, uuid) => [
        'POST',
        '/synced-role/remove-member',
        { ...role, uuid },
    ],
    /**
     * Adds a member to a synced-role.
     * @param {SyncedRoleData} role - The synced role to remove the member from.
     * @param {string} uuid - The UUID of the member to add.
     * @returns {HttpProtocolFetchData}
     */
    AddSyncedRoleMember: (role, uuid) => [
        'POST',
        '/synced-role/add-member',
        { ...role, uuid },
    ],
    /**
     * Lists the online players on the server.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    ListOnlinePlayers: () => [
        'GET',
        '/players',
    ],
    /**
     * Lists the teams and luckperms groups on the server.
     * @returns {HttpProtocolFetchData} - The data to send to the plugin.
     */
    ListTeamsAndGroups: () => [
        'GET',
        '/teams-and-groups',
    ],
};


export default class HttpProtocol extends Protocol {

    /**
     * @typedef {object} HttpProtocolData
     * @property {string} ip - The ip the plugin is listening on.
     * @property {number} port - The port the plugin is listening on.
     * @property {string} token - The token used to authenticate with the plugin.
     * @property {string} id - The guild id this protocol is for.
     */

    /**
     * @typedef {array} HttpProtocolFetchData
     * @property {string} 0 - The http method to use.
     * @property {string} 1 - The route to fetch from.
     * @property {object|ReadableStream} 2 - The body to send with the request.
     * @property {Object.<string, string>} 3 - The queries to send with the request.
     * @property {string} 4 - The authorization headers to send with the request.
     */

    /**
     * Creates a new http protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     * @param {HttpProtocolData} data - The data for the protocol.
     */
    constructor(client, data) {
        super(client);

        this._patch(data);
    }

    /**
     * Fetches a url with the given data.
     * @param {string} method - The http method to use.
     * @param {URL} url - The url to fetch.
     * @param {string} token - The token to use for authentication.
     * @param {?object} [body={}] - The body to send with the request.
     * @param {?string} [authorization=null] - Additional authorization headers to send with the request.
     * @returns {Promise<null|Response>} - The response from the server.
     * @private
     */
    static async fetch(method, url, token, body = {}, authorization = null) {
        try {
            let authorizationString = `Bearer ${token}`;
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
        // noinspection HttpUrlsUsage
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
     * @param {?RequiredRoleToJoinData} requiredRoleToJoin - The data for the required roles to join the server.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async connect(verifyCode, requiredRoleToJoin = null) {
        const response = await this._fetch(...PluginRoutes.Connect(`${this.ip}:${this.port}`, this.id, verifyCode, requiredRoleToJoin));
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
        const response = await this._fetch(...PluginRoutes.ListFiles(folder));
        return fetchToProtocolResponse(response);
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
     * Adds a chatchannel to the server.
     * @param {ChatChannelData} channel - The chatchannel to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addChatChannel(channel) {
        const response = await this._fetch(...PluginRoutes.AddChannel(channel));
        return fetchToProtocolResponse(response);
    }

    /**
     * Removes a chatchannel from the server.
     * @param {ChatChannelData} channel - The chatchannel to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeChatChannel(channel) {
        if(channel.webhook) {
            try {
                const webhook = await this.client.fetchWebhook(channel.webhook);
                await webhook.delete();
            }
            catch(_) {}
        }

        const response = await this._fetch(...PluginRoutes.RemoveChannel(channel));
        return fetchToProtocolResponse(response);
    }

    /**
     * Adds a stats-channel to the server.
     * @param {StatsChannelData} channel - The stats-channel to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addStatsChannel(channel) {
        const response = await this._fetch(...PluginRoutes.AddStatsChannel(channel));
        return fetchToProtocolResponse(response);
    }

    /**
     * Removes a stats-channel from the server.
     * @param {StatsChannelData} channel - The stats-channel to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeStatsChannel(channel) {
        const response = await this._fetch(...PluginRoutes.RemoveStatsChannel(channel));
        return fetchToProtocolResponse(response);
    }

    /**
     * Adds a synced-role to the server.
     * @param {SyncedRoleData} role - The synced-role to add.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addSyncedRole(role) {
        const response = await this._fetch(...PluginRoutes.AddSyncedRole(role));
        return fetchToProtocolResponse(response);
    }

    /**
     * Removes a synced-role from the server.
     * @param {SyncedRoleData} role - The synced-role to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeSyncedRole(role) {
        const response = await this._fetch(...PluginRoutes.RemoveSyncedRole(role));
        return fetchToProtocolResponse(response);
    }

    /**
     * Adds a member to a synced-role.
     * @param {SyncedRoleData} role - The synced role to remove the member from.
     * @param {string} uuid - The UUID of the member to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async addSyncedRoleMember(role, uuid) {
        const response = await this._fetch(...PluginRoutes.AddSyncedRoleMember(role, uuid));
        return fetchToProtocolResponse(response);
    }

    /**
     * Removes a member from a synced-role.
     * @param {SyncedRoleData} role - The synced role to remove the member from.
     * @param {string} uuid - The UUID of the member to remove.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async removeSyncedRoleMember(role, uuid) {
        const response = await this._fetch(...PluginRoutes.RemoveSyncedRoleMember(role, uuid));
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
     * Gets the live snbt-data of a player. The Player has to be online for this endpoint to work.
     * @param {string} uuid - The uuid of the player to get the snbt-data of.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async getPlayerNbt(uuid) {
        const response = await this._fetch(...PluginRoutes.GetPlayerNbt(uuid));
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
     * Gets a list of teams and luckperms groups on the server.
     * @returns {Promise<?ProtocolResponse>} - The response from the plugin.
     */
    async getTeamsAndGroups() {
        const response = await this._fetch(...PluginRoutes.ListTeamsAndGroups());
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
    _fetch(method, route, body = {}, queries = {}, authorization = null) {
        try {
            // noinspection HttpUrlsUsage
            const url = new URL(`http://${this.ip}:${this.port}`);
            url.pathname = route;
            for(const key in queries) {
                url.searchParams.append(key, queries[key]);
            }

            return HttpProtocol.fetch(method, url, this.token, body, authorization);
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
