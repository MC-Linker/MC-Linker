import Connection from './Connection.js';
import HttpProtocol from './HttpProtocol.js';
import FtpProtocol from './FtpProtocol.js';
import WebSocketProtocol from './WebSocketProtocol.js';
import ServerSettingsConnection from './ServerSettingsConnection.js';

/** @template {Protocol} T */
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
     * @typedef {HttpServerConnectionData|FtpServerConnectionData|WebSocketServerConnectionData} ServerConnectionData - The data of the server.
     */

    /**
     * @typedef {ServerConnection|string} ServerConnectionResolvable - Data that resolves to a ServerConnection object.
     */

    /**
     * The protocol used to communicate with the server.
     * @type {T|Protocol}
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

        // Assign the protocol used to communicate with the server.
        if(data.protocol === 'http') {
            this.protocol = new HttpProtocol(client, {
                id: data.id,
                ip: data.ip,
                port: data.port,
                token: data.token,
            });
        }
        else if(data.protocol === 'ftp' || data.protocol === 'sftp') {
            this.protocol = new FtpProtocol(client, {
                ip: data.ip,
                port: data.port,
                password: data.password,
                username: data.username,
                sftp: data.protocol === 'sftp',
            });
        }
        else if(data.protocol === 'websocket') {
            this.protocol = new WebSocketProtocol(client, {
                id: data.id,
                ip: data.ip,
                hash: data.hash,
            });
        }

        this._patch(data);
    }

    /**
     * Returns the ip that should be displayed to users to connect to this server.
     * This returns the displayIp if it is set, otherwise it returns ip:port if port is set and not 25565, otherwise it returns just the ip.
     * @returns {string}
     */
    getDisplayIp() {
        // Either display ip, or ip:port, or (if port is 25565) just ip
        const serverIp = this.displayIp ?? this.ip;
        if(typeof this.port === 'number' && this.port !== 25565) return `${serverIp}:${this.port}`;
        else return serverIp;
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
         * The floodgate prefix of this server.
         * @type {string}
         */
        this.floodgatePrefix = data.floodgatePrefix ?? data['floodgate-prefix'] ?? this.floodgatePrefix;

        if('port' in data) {
            /**
             * The port of this server.
             * @type {?number}
             * */
            this.port = data.port;
        }
        if('username' in data) {
            /**
             * The ftp username used to connect to this server.
             * @type {?string}
             * */
            this.username = data.username;
        }
        if('password' in data) {
            /**
             * The ftp password used to connect to this server.
             * @type {?string}
             * */
            this.password = data.password;
        }
        if('token' in data) {
            /**
             * The token used to authenticate the bot for http connections.
             * @type {?string}
             * */
            this.token = data.token;
        }
        if('hash' in data) {
            /**
             * The connection hash used to authenticate the plugin for websocket connections.
             * @type {?string}
             */
            this.hash = data.hash;
        }
        if('channels' in data || 'chatChannels' in data) {
            /**
             * The chatchannels connected to this server.
             * @type {?ChatChannelData[]}
             * */
            this.chatChannels = data.chatChannels ?? data.channels;
        }
        if('stats-channels' in data || 'statChannels' in data || 'statsChannels' in data) {
            /**
             * The data for stats channels.
             * @type {?StatsChannelData[]}
             */
            this.statChannels = data.statChannels ?? data.statsChannels ?? data['stats-channels'];
        }
        if('syncedRoles' in data) {
            /**
             * The data for syncedRoles.
             * @type {?SyncedRoleData[]}
             */
            this.syncedRoles = data.syncedRoles;
        }
        if('requiredRoleToJoin' in data) {
            /**
             * The role required to join this server.
             * @type {?RequiredRoleToJoinData}
             */
            this.requiredRoleToJoin = data.requiredRoleToJoin;
        }
        if('displayIp' in data) {
            /**
             * The ip that will be displayed to users to connect to this server.
             * @type {?string}
             */
            this.displayIp = data.displayIp;
        }

        //Switch protocols if needed
        if(!this.protocol.isHttpProtocol() && data.protocol === 'http') {
            this.protocol = new HttpProtocol(this.client, {
                id: data.id,
                ip: this.ip,
                port: this.port,
                token: this.token,
            });
            delete this.username;
            delete this.password;
            delete this.channels;
            delete this.hash;
        }
        else if(!this.protocol.isFtpProtocol() && (data.protocol === 'ftp' || data.protocol === 'sftp')) {
            this.protocol = new FtpProtocol(this.client, {
                ip: this.ip,
                port: this.port,
                password: this.password,
                username: this.username,
                sftp: data.protocol === 'sftp',
            });

            delete this.token;
            delete this.hash;
            delete this.syncedRoles;
            delete this.chatChannels;
            delete this.statChannels;
            delete this.requiredRoleToJoin;
            delete this.displayIp;
        }
        else if(!this.protocol.isWebSocketProtocol() && data.protocol === 'websocket') {
            this.protocol = new WebSocketProtocol(this.client, {
                id: this.id,
                ip: this.ip,
                hash: this.hash,
                displayIp: this.displayIp,
            });

            delete this.token;
            delete this.username;
            delete this.password;
            delete this.channels;
        }
        else this.protocol._patch({ ...data, sftp: data.protocol === 'sftp' });
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
