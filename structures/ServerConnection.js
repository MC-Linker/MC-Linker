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
     * @property {SyncedRoleData[]} syncedRoles - The data for syncedRoles.
     * @property {ChatChannelData[]} chatChannels - The chatchannels connected to the server.
     * @property {StatsChannelData[]} statChannels - The data for stats channels.
     * @property {'http'|HttpProtocol} protocol - The protocol used to connect to the server.
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
     * @property {'ftp'|'sftp'|FtpProtocol} protocol - The protocol used to connect to the server.
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
     * @property {'websocket'|WebSocketProtocol} protocol - The protocol used to connect to the server.
     * @property {import('socket.io').Socket} socket - The connected websocket used to communicate with the server.
     */

    /**
     * @typedef {HttpServerConnectionData|FtpServerConnectionData|WebSocketServerConnectionData} ServerData - The data for a server.
     */

    /**
     * @typedef {object} ServerConnectionData - The data of the server.
     * @property {string} id - The id of the server.
     * @property {(ServerData)[]} servers - The connected servers.
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
         * @type {(ServerData)[]}
         */
        this.servers = data.servers ?? this.servers ?? [];

        if(data.protocol === 'http') {
            this.servers.push({
                ip: data.ip,
                name: data.name,
                port: data.port,
                version: data.version,
                worldPath: data.worldPath,
                path: data.path,
                token: data.token,
                online: data.online,
                floodgatePrefix: data.floodgatePrefix ?? null,
                requiredRoleToJoin: data.requiredRoleToJoin ?? null,
                chatChannels: data.chatChannels ?? [],
                statChannels: data.statChannels ?? [],
                syncedRoles: data.syncedRoles ?? [],
                protocol: data.protocol,
            });
        }
        else if(data.protocol === 'ftp' || data.protocol === 'sftp') {
            this.servers.push({
                ip: data.ip,
                name: data.name,
                username: data.username,
                password: data.password,
                port: data.port,
                version: data.version,
                worldPath: data.worldPath,
                path: data.path,
                online: data.online,
                floodgatePrefix: data.floodgatePrefix ?? null,
                protocol: data.protocol,
            });
        }
        else if(data.protocol === 'websocket') {
            this.servers.push({
                ip: data.ip,
                name: data.name,
                version: data.version,
                worldPath: data.worldPath,
                path: data.path,
                hash: data.hash,
                online: data.online,
                forceOnlineMode: data.forceOnlineMode,
                floodgatePrefix: data.floodgatePrefix ?? null,
                displayIp: data.displayIp ?? null,
                requiredRoleToJoin: data.requiredRoleToJoin ?? null,
                chatChannels: data.chatChannels ?? [],
                statChannels: data.statChannels ?? [],
                syncedRoles: data.syncedRoles ?? [],
                protocol: data.protocol,
            });
        }


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

            server.protocol._patch(server);
        }
    }

    /**
     * Adds a new server to the server-connection.
     * @param {ServerData} data
     */
    addServer(data) {
        // Check if the server already exists (plugin already prevents duplicate connections so only ftp has to be checked)
        const existingFtpServer = this.servers.findIndex(s => {
            return data.protocol === 'ftp' && s.protocol.isFtpProtocol() && s.ip === data.ip && s.port === data.port;
        });
        if(existingFtpServer !== -1) this.servers[existingFtpServer] = data;
        else this.servers.push(data);

        this._patch(this);
    }

    removeServer(data) {
        const server = this.servers.find(s => s.name === data.name || s.ip === data.ip);
        if(server) this.servers.splice(this.servers.indexOf(server), 1);
    }

    /**
     * Finds the server that includes the given name/ip or finds the first server (priority: websocket, http, ftp) if there's no match.
     * @param {?string} nameOrIp - The name/ip of the server to get.
     * @return {ServerData} - The server with the given name/ip or the first server.
     */
    findServer(nameOrIp) {
        return this.servers.find(s => s.name === nameOrIp || s.ip === nameOrIp) ??
            this.servers.find(s => s.name.includes(nameOrIp)) ??
            this.servers.find(s => s.protocol.isWebSocketProtocol()) ??
            this.servers.find(s => s.protocol.isHttpProtocol()) ??
            this.servers.find(s => s.protocol.isFtpProtocol());
    }

    /**
     * Syncs the roles of a user with the server.
     * @param {Guild} guild - The guild to sync the roles of the user in.
     * @param {import('discord.js').GuildMember} member - The user to sync the roles of.
     * @param {UserConnection} userConnection - The user connection to sync the roles of.
     * @returns {Promise<void>}
     */
    async syncRoles(guild, member, userConnection) {
        const servers = this.servers.filter(s => s.protocol.isPluginProtocol() && this.syncedRoles && this.syncedRoles.length > 0);
        for(const server of servers) {
            //If user has a synced-role, tell the plugin
            for(const syncedRole of server.syncedRoles.filter(r =>
                !r.players.includes(userConnection.uuid) && member.roles.cache.has(r.id))) {
                await server.protocol.addSyncedRoleMember(syncedRole, userConnection.uuid);
            }

            // Add missing synced roles
            for(const syncedRole of server.syncedRoles.filter(r =>
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
        return {
            id: this.id,
            servers: this.servers.map(s => {
                const baseData = {
                    ip: s.ip,
                    version: s.version,
                    path: s.path,
                    worldPath: s.worldPath,
                    online: s.online,
                    forceOnlineMode: s.forceOnlineMode,
                    floodgatePrefix: s.floodgatePrefix,
                };

                if(s.protocol.isHttpProtocol()) {
                    return {
                        ...baseData,
                        port: s.port,
                        token: s.token,
                        requiredRoleToJoin: s.requiredRoleToJoin,
                        chatChannels: s.chatChannels ?? [],
                        statChannels: s.statChannels ?? [],
                        syncedRoles: s.syncedRoles ?? [],
                        protocol: 'http',
                    };
                }
                else if(s.protocol.isFtpProtocol()) {
                    return {
                        ...baseData,
                        port: s.port,
                        password: s.password,
                        username: s.username,
                        protocol: s.protocol.sftp ? 'sftp' : 'ftp',
                    };
                }
                else if(s.protocol.isWebSocketProtocol()) {
                    return {
                        ...baseData,
                        hash: s.hash,
                        requiredRoleToJoin: s.requiredRoleToJoin,
                        chatChannels: s.chatChannels ?? [],
                        statChannels: s.statChannels ?? [],
                        syncedRoles: s.syncedRoles ?? [],
                        protocol: 'websocket',
                    };
                }
            }),
        };
    }
}
