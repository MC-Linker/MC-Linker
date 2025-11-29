import Connection from './Connection.js';
import WebSocketProtocol from './WebSocketProtocol.js';
import ServerSettingsConnection from './ServerSettingsConnection.js';
import fs from 'fs-extra';
import { addPh } from '../utilities/messages.js';

export default class ServerConnection extends Connection {

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
     * @typedef {object} HttpServerConnectionData - The data for a server-connection established by the plugin.
     * @property {string} id - The id of the server.
     * @property {string} ip - The ip of the server.
     * @property {number} port - The port used to connect to the server plugin.
     * @property {number} version - The minor minecraft version of the server.
     * @property {string} worldPath - The path to the world folder of the server.
     * @property {string} path - The path to the server folder of the server.
     * @property {string} token - The connection token used to connect to the server plugin.
     * @property {boolean} online - Whether online mode is enabled on this server.
     * @property {string} [floodgatePrefix] - The prefix used for floodgate usernames.
     * @property {RequiredRoleToJoinData} [requiredRoleToJoin] - The id of the role required to join the server.
     * @property {ChatChannelData[]} chatChannels - The chatchannels connected to the server.
     * @property {StatsChannelData[]} statChannels - The data for stats channels.
     * @property {'http'} protocol - The protocol used to connect to the server.
     */

    /**
     * @typedef {object} FtpServerConnectionData - The data for a server-connection established by ftp or sftp.
     * @property {string} id - The id of the server.
     * @property {string} ip - The ip of the server.
     * @property {string} username - The ftp username used to connect to the server.
     * @property {string} password - The ftp password used to connect to the server.
     * @property {number} port - The ftp port used to connect to the server.
     * @property {number} version - The minor minecraft version of the server.
     * @property {string} worldPath - The path to the world folder of the server.
     * @property {string} path - The path to the server folder of the server.
     * @property {boolean} online - Whether the server-connection has online mode enabled or not.
     * @property {string} [floodgatePrefix] - The prefix used for floodgate usernames.
     * @property {'ftp'|'sftp'} protocol - The protocol used to connect to the server.
     */

    /**
     * @typedef {object} WebSocketServerConnectionData - The data for a server-connection established by a websocket.
     * @property {string} id - The id of the server.
     * @property {string} ip - The ip of the server.
     * @property {number} version - The minor minecraft version of the server.
     * @property {string} worldPath - The path to the world folder of the server.
     * @property {string} path - The path to the server folder of the server.
     * @property {string} hash - The connection hash used to authenticate the plugin for websocket connections.
     * @property {boolean} online - Whether online mode is enabled on this server.
     * @property {boolean} forceOnlineMode - Whether to update the online mode when the server reconnects.
     * @property {string} [floodgatePrefix] - The prefix used for floodgate usernames.
     * @property {string} [displayIp] - The ip address that the bot should show users for joining the server.
     * @property {RequiredRoleToJoinData} [requiredRoleToJoin] - An array of role ids, at least one of which is required to join the server.
     * @property {ChatChannelData[]} chatChannels - The chatchannels connected to the server.
     * @property {StatsChannelData[]} statChannels - The data for stats channels.
     * @property {SyncedRoleData[]} syncedRoles - The data for syncedRoles.
     * @property {import('socket.io').Socket} socket - The connected websocket used to communicate with the server.
     */

    /**
     * @typedef {WebSocketServerConnectionData} ServerConnectionData - The data of the server.
     */

    /**
     * @typedef {ServerConnection|string} ServerConnectionResolvable - Data that resolves to a ServerConnection object.
     */

    /** Default timeout in seconds used to check for stat channel updates */
    STAT_CHANNEL_CHECK_DEFAULT_TIMEOUT = 60 * 5.1;
    /** Timeout used when the previous call did not change any name */
    STAT_CHANNEL_CHECK_NO_CHANGE_TIMEOUT

    /**
     * The protocol used to communicate with the server.
     * @type {WebSocketProtocol}
     */
    protocol;

    /**
     * @param {MCLinker} client - The client to create the server-connection for.
     * @param {ServerConnectionData} data - The data for the server-connection.
     * @param {CollectionName} collectionName - The name of the database collection that this connection is stored in.
     * @returns {ServerConnection} - A new ServerConnection instance.
     */
    constructor(client, data, collectionName = 'ServerConnection') {
        super(client, data, collectionName);

        /**
         * The settings for this server.
         * @type {ServerSettingsConnection}
         */
        this.settings = client.serverSettingsConnections._add(ServerSettingsConnection.defaultSettingsData, true, {
            extras: [client.serverSettingsConnections.collectionName],
        });

        this.protocol = new WebSocketProtocol(client, {
            id: data.id,
            ip: data.ip,
            hash: data.hash,
            socket: data.socket,
        });

        this._patch(data);
    }

    _patch(data) {
        /**
         * The id of this server.
         * @type {string}
         * */
        this.id = data.id ?? this.id;

        /**
         * The ip of this server.
         * @type {string}
         * */
        this.ip = data.ip ?? this.ip;

        /**
         * The minecraft version of this server.
         * @type {number}
         * */
        this.version = data.version ?? this.version;

        /**
         * The path to the world folder of this server.
         * @type {string}
         * */
        this.worldPath = data.worldPath ?? this.worldPath;

        /**
         * The path to the server folder of this server.
         * @type {string}
         */
        this.path = data.path ?? this.path;

        /**
         * Whether online mode is enabled on this server.
         * @default true
         * @type {boolean}
         * */
        this.online = data.online ?? this.online ?? true;

        /**
         * Whether to update the online mode when the server reconnects.
         * @default true
         * @type {boolean}
         * */
        this.forceOnlineMode = data.forceOnlineMode ?? this.forceOnlineMode ?? true;

        /**
         * The chatchannels connected to this server.
         * @type {?ChatChannelData[]}
         * */
        this.chatChannels = data.chatChannels ?? this.chatChannels ?? [];

        /**
         * The data for stats channels.
         * @type {?StatsChannelData[]}
         */
        this.statChannels = data.statChannels ?? this.statChannels ?? [];
        if(this.statChannels.length > 0) {
            this.startStatChannelCheck();
        }

        /**
         * The data for syncedRoles.
         * @type {?SyncedRoleData[]}
         */
        this.syncedRoles = data.syncedRoles ?? this.syncedRoles ?? [];

        /**
         * The ip that will be displayed to users to connect to this server.
         * Either display ip or just ip
         * @type {string}
         */
        this.displayIp = data.displayIp ?? this.displayIp ?? this.ip;

        /**
         * The floodgate prefix of this server.
         * @type {?string}
         */
        this.floodgatePrefix = data.floodgatePrefix ?? this.floodgatePrefix ?? null;

        /**
         * The role required to join this server.
         * @type {?RequiredRoleToJoinData}
         */
        this.requiredRoleToJoin = data.requiredRoleToJoin ?? this.requiredRoleToJoin ?? null;

        /**
         * The connection hash used to authenticate the plugin for websocket connections.
         * @type {?string}
         */
        this.hash = data.hash ?? this.hash ?? null;
    }

    /**
     * Syncs the roles of a user with the server.
     * @param {Guild} guild - The guild to sync the roles of the user in.
     * @param {import('discord.js').GuildMember} member - The user to sync the roles of.
     * @param {UserConnection} userConnection - The user connection to sync the roles of.
     * @returns {Promise<void>}
     */
    async syncRoles(guild, member, userConnection) {
        if(this.syncedRoles && this.syncedRoles.length > 0) {
            //If user has a synced-role, tell the plugin
            for(const syncedRole of this.syncedRoles.filter(r =>
                !r.players.includes(userConnection.uuid) && member.roles.cache.has(r.id))) {
                await this.protocol.addSyncedRoleMember(syncedRole, userConnection.uuid);
            }

            // Add missing synced roles
            for(const syncedRole of this.syncedRoles.filter(r =>
                r.players.includes(userConnection.uuid) && !member.roles.cache.has(r.id))) {
                try {
                    const discordMember = await guild.members.fetch(userConnection.id);
                    const role = await guild.roles.fetch(syncedRole.id);
                    await discordMember.roles.add(role);
                }
                catch(_) {}
            }
        }
    }

    async _output() {
        if(await super._output())
            return await this.settings._output();
        else return false;
    }

    /**
     * Removes the download cache folder of this server connection.
     * @returns {Promise<boolean>}
     */
    async removeCache() {
        try {
            await fs.rm(`./download-cache/serverConnection/${this.id}/`, { recursive: true });
            return true;
        }
        catch(_) {
            return false;
        }
    }

    getData() {
        return {
            id: this.id,
            ip: this.ip,
            version: this.version,
            path: this.path,
            worldPath: this.worldPath,
            online: this.online,
            forceOnlineMode: this.forceOnlineMode,
            floodgatePrefix: this.floodgatePrefix,
            hash: this.hash,
            requiredRoleToJoin: this.requiredRoleToJoin,
            chatChannels: this.chatChannels ?? [],
            statChannels: this.statChannels ?? [],
            syncedRoles: this.syncedRoles ?? [],
            protocol: 'websocket',
        };
    }

    /**
     * Updates the names of a stat channel of this server.
     * @param {StatsChannelData} statChannel - The stat channel to update the name of.
     * @returns {Promise<void>}
     */
    async updateStatChannelName(statChannel) {
        let message;
        if(statChannel.type === 'member-counter') {
            if(!this.protocol.isConnected()) return;
            const onlinePlayers = await this.protocol.getOnlinePlayers();
            if(!onlinePlayers || onlinePlayers.status !== 200) return;

            message = statChannel.names.members.replace('%count%', onlinePlayers.data.length);
        }
        else if(statChannel.type === 'status')
            message = this.protocol.isConnected() ? statChannel.names.online : statChannel.names.offline;

        try {
            const discordChannel = await this.client.channels.fetch(statChannel.id);
            await discordChannel.setName(message);
        }
        catch(err) {
            if(err.code === 10003) { // Channel not found
                const regChannel = await this.protocol.removeStatsChannel(statChannel);
                if(!regChannel) return;
                await this.edit({ statChannels: regChannel.data });
            }
        }
    }
}
