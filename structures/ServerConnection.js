import Connection from './Connection.js';
import HttpProtocol from './HttpProtocol.js';
import FtpProtocol from './FtpProtocol.js';
import WebSocketProtocol from './WebSocketProtocol.js';

export default class ServerConnection extends Connection {

    /**
     * @typedef {object} ChatChannelData - The data for a chatchannel.
     * @property {string} id - The id of the channel.
     * @property {string[]} types - The enabled types of the chatchannel.
     * @property {string} [webhook] - The webhook id of the chatchannel.
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
     * @property {ChatChannelData[]} [channels] - The chatchannels connected to the server.
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
     * @property {ChatChannelData[]} [channels] - The chatchannels connected to the server.
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
     * @param {MCLinker} client - The client to create the server-connection for.
     * @param {ServerConnectionData} data - The data for the server-connection.
     * @param {string} outputPath - The path to write the server-connection to.
     * @param {string} [outputFile='connection.json'] - The file to write the server-connection to.
     * @returns {ServerConnection} - A new ServerConnection instance.
     */
    constructor(client, data, outputPath, outputFile = 'connection.json') {
        super(client, data, outputPath, outputFile);

        /**
         * The settings for this server.
         * @type {ServerSettingsConnection}
         */
        this.settings = client.serverSettingsConnections._add(data.id, true, {
            id: data.id,
            extras: [client.serverSettingsConnections.outputPath],
        });

        // Assign the protocol used to communicate with the server.
        if(data.protocol === 'http') {
            /**
             * The http protocol for this server.
             * @type {HttpProtocol}
             */
            this.protocol = new HttpProtocol(client, {
                id: data.id,
                ip: data.ip,
                port: data.port,
                token: data.token,
            });
        }
        else if(data.protocol === 'ftp') {
            /**
             * The ftp protocol for this server.
             * @type {FtpProtocol}
             */
            this.protocol = new FtpProtocol(client, {
                ip: data.ip,
                port: data.port,
                password: data.password,
                username: data.username,
                sftp: data.protocol === 'sftp',
            });
        }
        else if(data.protocol === 'websocket') {
            /**
             * The websocket protocol for this server.
             * @type {WebSocketProtocol}
             */
            this.protocol = new WebSocketProtocol(client, {
                id: data.id,
                ip: data.ip,
                hash: data.hash,
            });
        }

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
         * @type {boolean}
         * */
        this.online = data.online ?? this.online;

        if('port' in data) {
            /**
             * The port of this server.
             * @type {number}
             * */
            this.port = data.port ?? this.port;
        }
        if('username' in data) {
            /**
             * The ftp username used to connect to this server.
             * @type {string}
             * */
            this.username = data.username;
        }
        if('password' in data) {
            /**
             * The ftp password used to connect to this server.
             * @type {string}
             * */
            this.password = data.password;
        }
        if('token' in data) {
            /**
             * The token used to authenticate the bot for http connections.
             * @type {string}
             * */
            this.token = data.token;
        }
        if('hash' in data) {
            /**
             * The connection hash used to authenticate the plugin for websocket connections.
             * @type {string}
             */
            this.hash = data.hash;
        }
        if('channels' in data) {
            /**
             * The chatchannels connected to this server.
             * @type {ChatChannelData[]}
             * */
            this.channels = data.channels;
        }

        //Switch protocols if needed
        if(!this.hasHttpProtocol() && data.protocol === 'http') {
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
        else if(!this.hasFtpProtocol() && (data.protocol === 'ftp' || data.protocol === 'sftp')) {
            this.protocol = new FtpProtocol(this.client, {
                ip: this.ip,
                port: this.port,
                password: this.password,
                username: this.username,
                sftp: data.protocol === 'sftp',
            });

            delete this.token;
            delete this.hash;
            delete this.channels;
        }
        else if(!this.hasWebSocketProtocol() && data.protocol === 'websocket') {
            this.protocol = new WebSocketProtocol(this.client, {
                id: this.id,
                ip: this.ip,
                hash: this.hash,
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
        };

        if(this.hasHttpProtocol()) {
            return {
                ...baseData,
                port: this.port,
                token: this.token,
                channels: this.channels ?? [],
                protocol: 'http',
            };
        }
        else if(this.hasFtpProtocol()) {
            return {
                ...baseData,
                port: this.port,
                password: this.password,
                username: this.username,
                protocol: this.protocol.sftp ? 'sftp' : 'ftp',
            };
        }
        else if(this.hasWebSocketProtocol()) {
            return {
                ...baseData,
                hash: this.hash,
                channels: this.channels ?? [],
                protocol: 'websocket',
            };
        }
    }

    /**
     * Checks whether this server is connected with a http connection.
     * @returns {boolean}
     */
    hasHttpProtocol() {
        return this.protocol instanceof HttpProtocol;
    }

    /**
     * Checks whether this server is connected to a ftp server.
     * @returns {boolean}
     */
    hasFtpProtocol() {
        return this.protocol instanceof FtpProtocol;
    }

    /**
     * Checks whether this server is connected with a websocket connection.
     * @returns {boolean}
     */
    hasWebSocketProtocol() {
        return this.protocol instanceof WebSocketProtocol;
    }
}
