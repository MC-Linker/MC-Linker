import Connection from './Connection.js';
import HttpProtocol from './HttpProtocol.js';
import FtpProtocol from './FtpProtocol.js';
import WebSocketProtocol from './WebSocketProtocol.js';
import ServerSettingsConnection from './ServerSettingsConnection.js';

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
     * @property {string} name - The name of the server.
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
     * @property {string} name - The name of the server.
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
     * @property {string} name - The name of the server.
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
     * @property {'websocket'} protocol - The protocol used to connect to the server.
     * @property {import('socket.io').Socket} socket - The connected websocket used to communicate with the server.
     */

    /**
     * @typedef {object} ServerConnectionData - The data of the server.
     * @property {string} id - The id of the server.
     * @property {(HttpServerConnectionData|FtpServerConnectionData|WebSocketServerConnectionData)[]} servers - The connected servers.
     */

    /**
     * @typedef {ServerConnection|string} ServerConnectionResolvable - Data that resolves to a ServerConnection object.
     */

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
    }

    /**
     * Returns the ip that should be displayed to users to connect to this server.
     * This returns the displayIp if it is set, otherwise it returns just the ip.
     * @returns {string}
     */
    getDisplayIp() {
        // Either display ip, or just ip
        return this.displayIp ?? this.ip;
    }

    _patch(data) {

        /**
         * The id of this server.
         * @type {string}
         */
        this.id = data.id ?? this.id;

        /**
         * The connected servers.
         * @type {(HttpServerConnectionData|FtpServerConnectionData|WebSocketServerConnectionData)[]}
         */
        this.servers = data.servers ?? this.servers;

        for(const server of this.servers) {
            if(server.protocol === 'http') {
                server.protocol = new HttpProtocol(this.client, {
                    id: server.id,
                    ip: server.ip,
                    port: server.port,
                    token: server.token,
                });
            }
            else if(server.protocol === 'ftp' || server.protocol === 'sftp') {
                server.protocol = new FtpProtocol(this.client, {
                    ip: server.ip,
                    port: server.port,
                    password: server.password,
                    username: server.username,
                    sftp: server.protocol === 'sftp',
                });
            }
            else if(server.protocol === 'websocket') {
                server.protocol = new WebSocketProtocol(this.client, {
                    id: server.id,
                    ip: server.ip,
                    hash: server.hash,
                    displayIp: server.displayIp,
                });
            }

            this.protocol._patch(server);
        }
    }

    /**
     * Syncs the roles of a user with the server.
     * @param {Guild} guild - The guild to sync the roles of the user in.
     * @param {import('discord.js').GuildMember} member - The user to sync the roles of.
     * @param {UserConnection} userConnection - The user connection to sync the roles of.
     * @returns {Promise<void>}
     */
    async syncRoles(guild, member, userConnection) {
        if(this.protocol.isPluginProtocol() && this.syncedRoles && this.syncedRoles.length > 0) {
            //If user has a synced-role, tell the plugin
            for(const syncedRole of this.syncedRoles.filter(r =>
                !r.players.includes(userConnection.uuid) && member.roles.cache.has(r.id))) {
                await this.protocol.addSyncedRoleMember(syncedRole, userConnection.uuid)
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
        if(await super._output()) {
            return await this.settings._output();
        }
        else return false;
    }

    /**
     * @inheritDoc
     */
    getData() {
        const baseData = {
            id: this.id,
            ip: this.ip,
            version: this.version,
            path: this.path,
            worldPath: this.worldPath,
            online: this.online,
            forceOnlineMode: this.forceOnlineMode,
            floodgatePrefix: this.floodgatePrefix,
        };

        if(this.protocol.isHttpProtocol()) {
            return {
                ...baseData,
                port: this.port,
                token: this.token,
                requiredRoleToJoin: this.requiredRoleToJoin,
                chatChannels: this.chatChannels ?? [],
                statChannels: this.statChannels ?? [],
                syncedRoles: this.syncedRoles ?? [],
                protocol: 'http',
            };
        }
        else if(this.protocol.isFtpProtocol()) {
            return {
                ...baseData,
                port: this.port,
                password: this.password,
                username: this.username,
                protocol: this.protocol.sftp ? 'sftp' : 'ftp',
            };
        }
        else if(this.protocol.isWebSocketProtocol()) {
            return {
                ...baseData,
                hash: this.hash,
                requiredRoleToJoin: this.requiredRoleToJoin,
                chatChannels: this.chatChannels ?? [],
                statChannels: this.statChannels ?? [],
                syncedRoles: this.syncedRoles ?? [],
                protocol: 'websocket',
            };
        }
    }
}
