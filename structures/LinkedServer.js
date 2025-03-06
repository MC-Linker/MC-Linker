import fs from 'fs-extra';
import { Base } from 'discord.js';

export default class LinkedServer extends Base {

    /**
     * @typedef {object} ChatChannelData - The data for a chatchannel.
     * @property {string} id - The id of the channel.
     * @property {string[]} types - The enabled types of the chatchannel.
     * @property {string} [allowDiscordToMinecraft] - Whether the chatchannel should send messages from discord to minecraft.
     * @property {string} [webhook] - The webhook id of the chatchannel.
     */

    /**
     * @typedef {object} StatsChannelData - The data for a stats channel.
     * @property {'member-counter'|'status'} type - The type of the stats channel.
     * @property {string} id - The id of the channel.
     * @property {object} names - The names for the stats channel.
     * @property {string} [names.online] - The name when the server is online.
     * @property {string} [names.offline] - The name when the server is offline.
     * @property {string} [names.members] - The name for the member count.
     */

    /**
     * @typedef {object} SyncedRoleData - The data for a synced-role.
     * @property {string} id - The id of the role.
     * @property {string} name - The name of the group/team.
     * @property {boolean} isGroup - Whether the role is a luckperms group or a Minecraft team.
     * @property {string[]} players - The player's uuids that are in the team/group.
     */

    /**
     * @typedef {object} RequiredRoleToJoinData - The data for required roles to join the server.
     * @property {'any'|'all'} method - The method used to determine if a user can join the server.
     * @property {string[]} roles - The ids of the roles required to join the server.
     */

    /**
     * @typedef {object} LinkedServerData - The data for a linked server.
     * @property {string} id - The guild id this server is linked with.
     * @property {string} ip - The ip the websocket client is listening on.
     * @property {string} name - The name of the server.
     * @property {number} version - The minor minecraft version of the server.
     * @property {string} worldPath - The path to the world folder of the server.
     * @property {string} path - The path to the server folder of the server.
     * @property {string} hash - The connection hash used to authenticate the plugin for websocket connections.
     * @property {boolean} online - Whether online mode is enabled on this server.
     * @property {boolean} forceOnlineMode - Whether to update the online mode when the server reconnects.
     * @property {string} [floodgatePrefix] - The prefix used for floodgate usernames.
     * @property {string} [displayIp] - The ip address that the bot should show users for joining the server.
     * @property {RequiredRoleToJoinData} [requiredRoleToJoin] - The data for required roles to join the server.
     * @property {ChatChannelData[]} [chatChannels] - The chatchannels connected to the server.
     * @property {StatsChannelData[]} [statChannels] - The data for stats channels.
     * @property {SyncedRoleData[]} [syncedRoles] - The data for syncedRoles.
     * @property {import('socket.io').Socket} [socket] - The connected WebSocket of this protocol.
     */

    /**
     * @typedef {object} FileData
     * @property {string} name - The name of the file.
     * @property {boolean} isDirectory - Whether the file is a directory.
     */

    /**
     * @typedef {object} PluginResponse - The response from a plugin call.
     * @property {any} data - The data of the response.
     */

    /**
     * The connected WebSocket of this protocol.
     * @type {?import('socket.io').Socket}
     */
    socket;

    /**
     * The ServerConnection this Server is linked to.
     * @type {ServerConnection}
     */
    serverConnection;

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     * @param {LinkedServerData} data - The data for the protocol.
     */
    constructor(client, data) {
        super(client);

        this.serverConnection = client.serverConnections.cache.get(data.id);

        this._patch(data);
    }

    _patch(data) {

        /**
         * The guild id this protocol is linked with.
         */
        this.id = data.id ?? this.id;

        /**
         * The ip the websocket client is listening on.
         * @type {string}
         */
        this.ip = data.ip ?? this.ip;

        /**
         * The name of the server.
         * @type {string}
         */
        this.name = data.name ?? this.name;

        /**
         * The minor minecraft version of the server.
         * @type {number}
         */
        this.version = data.version ?? this.version;

        /**
         * The path to the world folder of the server.
         * @type {string}
         */
        this.worldPath = data.worldPath ?? this.worldPath;

        /**
         * The path to the server folder of the server.
         * @type {string}
         */
        this.path = data.path ?? this.path;

        /**
         * The connection hash used to authenticate the plugin for websocket connections.
         * @type {string}
         */
        this.hash = data.hash ?? this.hash;

        /**
         * Whether online mode is enabled on this server.
         * @type {boolean}
         */
        this.online = data.online ?? this.online;

        /**
         * Whether to update the online mode when the server reconnects.
         * @type {boolean}
         */
        this.forceOnlineMode = data.forceOnlineMode ?? this.forceOnlineMode;

        /**
         * The prefix used for floodgate usernames.
         * @type {?string}
         */
        this.floodgatePrefix = data.floodgatePrefix ?? this.floodgatePrefix;

        /**
         * The ip address that the bot should show users for joining the server.
         * @type {?string}
         */
        this.displayIp = data.displayIp ?? this.displayIp;

        /**
         * The data for required roles to join the server.
         * @type {RequiredRoleToJoinData}
         */
        this.requiredRoleToJoin = data.requiredRoleToJoin ?? this.requiredRoleToJoin;

        /**
         * The chatchannels connected to the server.
         * @type {ChatChannelData[]}
         */
        this.chatChannels = data.chatChannels ?? this.chatChannels;

        /**
         * The data for stats channels.
         * @type {StatsChannelData[]}
         */
        this.statChannels = data.statChannels ?? this.statChannels;

        /**
         * The data for syncedRoles.
         * @type {SyncedRoleData[]}
         */
        this.syncedRoles = data.syncedRoles ?? this.syncedRoles;

        /**
         * The connected WebSocket of this protocol.
         * @type {?import('socket.io').Socket}
         */
        this.socket = data.socket ?? this.socket;
    }

    async edit(data) {
        this._patch(data);
        if(await this.serverConnection._output()) return this;
        return null;
    }

    /**
     * Gets a file from the server.
     * @param {string} getPath - The remote path where the file is located.
     * @param {string} putPath - The local path where the file should be written.
     * @returns {Promise<?PluginResponse & { data: Buffer }>} - The response from the server.
     */
    async get(getPath, putPath) {
        const response = await this._sendRaw('get-file', { path: getPath });
        if(!response) return null;
        if(response.type !== 'Buffer') return { status: response.status, data: null };

        await fs.outputFile(putPath, Buffer.from(response.data));
        return { status: 200, data: await fs.readFile(putPath) };
    }

    /**
     * Puts a file onto the server.
     * @param {string} getPath - The local path where the file is located.
     * @param {string} putPath - The remote path where the file should be written.
     * @returns {Promise<?PluginResponse>} - The response from the server.
     */
    async put(getPath, putPath) {
        return await this._sendRaw('put-file', { path: encodeURIComponent(putPath) }, await fs.readFile(getPath));
    }

    /**
     * Lists the files in a directory on the server.
     * @param {string} folder - The folder to list the files from.
     * @returns {Promise<Omit<?PluginResponse, 'data'> & { data: FileData[] }>} - The files in the folder.
     */
    list(folder) {
        return this._sendRaw('list-file', { folder });
    }

    /**
     * Disconnects from the plugin.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    disconnect() {
        return this.client.shard.broadcastEval(async (c, { id, ip }) => {
            /** @type {LinkedServer} */
            const protocol = c.serverConnections.cache.get(id).links
                .find(s => s.protocol.isWebSocketProtocol() && s.ip === ip);
            if(!protocol.socket) return { status: 200 };
            await protocol.socket.disconnect(true);
            return { status: 200 };
        }, { context: { id: this.id, ip: this.ip }, shard: 0 });
    }

    /**
     * Sends a public chat message to the server.
     * @param {string} message - The content of the message to send.
     * @param {string} username - The user who sent the message.
     * @param {?string=null} replyMessage - THe content of the message that was replied to.
     * @param {?string=null} replyUsername - The username of the user who sent the message that was replied to.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    chat(message, username, replyMessage = null, replyUsername = null) {
        const data = {
            msg: message,
            username,
            private: false,
        };
        if(replyMessage && replyUsername) {
            data.reply_msg = replyMessage;
            data.reply_username = replyUsername;
        }

        return this._sendRaw('chat', data);
    }

    /**
     * Sends a private chat message to a player on the server.
     * @param {string} message - The message to send.
     * @param {string} username - The user who sent the message.
     * @param {string} target - The username of the player to send the message to.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    chatPrivate(message, username, target) {
        const data = { msg: message, username, target, private: true };
        return this._sendRaw('chat', data);
    }

    /**
     * Adds a chat channel to the server.
     * @param {ChatChannelData} channel - The chat channel to add.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    addChatChannel(channel) {
        return this._sendRaw('add-channel', channel);
    }

    /**
     * Removes a stats channel from the server.
     * @param {ChatChannelData} channel - The stats channel to remove.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    async removeChatChannel(channel) {
        if(channel.webhook) {
            try {
                const webhook = await this.client.fetchWebhook(channel.webhook);
                await webhook.delete();
            }
            catch(_) {}
        }

        return await this._sendRaw('remove-channel', channel);
    }

    /**
     * Adds a stats channel to the server.
     * @param {StatsChannelData} channel - The stats channel to add.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    addStatsChannel(channel) {
        return this._sendRaw('add-stats-channel', channel);
    }

    /**
     * Removes a chat channel from the server.
     * @param {StatsChannelData} channel - The chat channel to remove.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    removeStatsChannel(channel) {
        return this._sendRaw('remove-stats-channel', channel);
    }

    /**
     * Adds a synced role to the server.
     * @param {SyncedRoleData} role - The synced role to add.
     * @returns {Promise<?PluginResponse>}
     */
    addSyncedRole(role) {
        return this._sendRaw('add-synced-role', role);
    }

    /**
     * Removes a synced role from the server.
     * @param {SyncedRoleData} role - The synced role to remove.
     * @returns {Promise<?PluginResponse>}
     */
    removeSyncedRole(role) {
        return this._sendRaw('remove-synced-role', role);
    }

    /**
     * Adds a member to a synced-role.
     * @param {SyncedRoleData} role - The synced role to add the member to.
     * @param {string} uuid - The UUID of the member to remove.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    addSyncedRoleMember(role, uuid) {
        return this._sendRaw('add-synced-role-member', { ...role, uuid });
    }

    /**
     * Removes a member from a synced-role.
     * @param {SyncedRoleData} role - The synced role to remove the member from.
     * @param {string} uuid - The UUID of the member to remove.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    removeSyncedRoleMember(role, uuid) {
        return this._sendRaw('remove-synced-role-member', { ...role, uuid });
    }

    /**
     * Executes a command on the server.
     * @param {string} command - The command to execute.
     * @param {?string} uuid - The uuid of the user who sent the command.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    execute(command, uuid = null) {
        return this._sendRaw('command', { cmd: encodeURIComponent(command), uuid });
    }

    /**
     * Gets the live snbt-data of a player. The Player has to be online for this endpoint to work.
     * @param {string} uuid - The uuid of the player to get the snbt-data of.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    getPlayerNbt(uuid) {
        return this._sendRaw('get-player-nbt', { uuid });
    }

    /**
     * Gets a list of online players on the server.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    getOnlinePlayers() {
        return this._sendRaw('list-players', {});
    }

    /**
     * Gets a list of all teams and luckperms groups on the server.
     * @returns {Promise<?PluginResponse>} - The response from the plugin.
     */
    getTeamsAndGroups() {
        return this._sendRaw('list-teams-and-groups', {});
    }

    /**
     * Sends a verification request to the server. Users can verify using `/verify <code>`.
     * @param {string} code - The verification code to send.
     * @param {string} uuid - The uuid of the user that sent the request.
     * @returns {Promise<?PluginResponse>} - The response from the websocket client.
     */
    verifyUser(code, uuid) {
        return this._sendRaw('verify-user', { code, uuid });
    }

    /**
     * Sends a raw event to the websocket client.
     * @param {string} name - The name of the event.
     * @param {...Serializable} data - The data to send.
     * @returns {Promise<?PluginResponse>}
     * @private
     */
    _sendRaw(name, ...data) {
        // Broadcast the event to shard 0 where the websocket server is running
        return this.client.shard.broadcastEval(async (c, { id, ip, name, data }) => {
            return await new Promise(resolve => {
                const server = c.serverConnections.cache.get(id).links.get(ip);

                /** @type {LinkedServer} */
                if(!server.socket) return resolve(null);
                server.socket.timeout(10_000).emit(name, ...data, (err, response) => {
                    if(err) return resolve(null);
                    if(typeof response === 'string') resolve(JSON.parse(response));
                    else resolve(response);
                });
            });
        }, { context: { id: this.id, ip: this.ip, name, data }, shard: 0 });
    }

    /**
     * Updates the connected websocket client of this protocol.
     * @param {import('socket.io').Socket} socket - The new socket to use.
     */
    updateSocket(socket) {
        this.socket = socket;
    }
}
