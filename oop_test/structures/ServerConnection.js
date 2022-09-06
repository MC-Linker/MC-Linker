const SettingsData = require('./SettingsConnection');
const Connection = require('./Connection');
const PluginProtocol = require('./PluginProtocol');
const FtpProtocol = require('./FtpProtocol');

class ServerConnection extends Connection {

    /**
     * @typedef {object} ChatChannelData - The data for a chatchannel.
     * @property {string} id - The id of the channel.
     * @property {string[]} types - The enabled types of the chatchannel.
     * @property {string} [webhook] - The related webhook of the chatchannel.
     */

    /**
     * @typedef {object} PluginServerConnectionData - The data for a server-connection established by the plugin.
     * @property {string} id - The id of the server.
     * @property {string} ip - The ip of the server.
     * @property {number} port - The port used to connect to the server plugin.
     * @property {number} version - The minor minecraft version of the server.
     * @property {string} path - The path to the world folder of the server.
     * @property {string} hash - The connection hash used to connect to the server plugin.
     * @property {boolean} online - Whether online mode is enabled on this server.
     * @property {boolean} chat - Whether there are connected chatchannels.
     * @property {ChatChannelData[]} [channels] - The chatchannels connected to the server.
     * @property {'plugin'} protocol - The protocol used to connect to the server.
     */

    /**
     * @typedef {object} FTPServerConnectionData - The data for a server-connection established by ftp or sftp.
     * @property {string} id - The id of the server.
     * @property {string} ip - The ip of the server.
     * @property {string} username - The ftp username used to connect to the server.
     * @property {string} password - The ftp password used to connect to the server.
     * @property {number} port - The ftp port used to connect to the server.
     * @property {number} version - The minor minecraft version of the server.
     * @property {string} path - The path to the world folder of the server.
     * @property {boolean} online - Whether the server-connection has online mode enabled or not.
     * @property {'ftp'|'sftp'} protocol - The protocol used to connect to the server.
     */

    /**
     * @typedef {PluginServerConnectionData|FTPServerConnectionData} ServerConnectionData - The data of the server.
     */

    /**
     * @typedef {ServerConnection|string} ServerConnectionResolvable - Data that resolves to a ServerConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the server-connection for.
     * @param {ServerConnectionData} data - The data for the server-connection.
     * @param {string} outputPath - The path to write the server-connection to.
     * @returns {ServerConnection} - A new ServerConnection instance.
     */
    constructor(client, data, outputPath) {
        super(client, data, outputPath);

        /**
         * The settings for this server.
         * @type {SettingsConnection}
         */
        this.settings = new SettingsData(client, this.id, outputPath);

        /**
         * The ftp or plugin protocol for this server.
         * @type {PluginProtocol|FtpProtocol}
         */
        this.protocol = data.protocol === 'plugin' ? new PluginProtocol(client) : new FtpProtocol(client);
    }

    async _patch(data) {
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
         * The port of this server.
         * @type {number}
         * */
        this.port = data.port ?? this.port;
        /**
         * The minecraft version of this server.
         * @type {number}
         * */
        this.version = data.version ?? this.version;
        /**
         * The path to the world folder of this server.
         * @type {string}
         * */
        this.path = data.path ?? this.path;
        /**
         * Whether online mode is enabled on this server.
         * @type {boolean}
         * */
        this.online = data.online ?? this.online;
        /**
         * The protocol used to connect to this server.
         * @type {'plugin'|'ftp'|'sftp'}
         * */
        this.protocol = data.protocol ?? this.protocol;


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
        if('hash' in data) {
            /**
             * The hash used to connect to this server's plugin.
             * @type {string}
             * */
            this.hash = data.hash;
        }
        if('channels' in data) {
            /**
             * The chatchannels connected to this server.
             * @type {ChatChannelData[]}
             * */
            this.channels = data.channels;
        }
    }

    /**
     * @inheritDoc
     */
    async output() {
        if(await super.output()) {
            return await this.settings.output();
        }
        else return false;
    }

    /**
     * @inheritDoc
     */
    async _delete() {
        if(await super._delete()) {
            return await this.settings._delete();
        }
        else return false;
    }

    /**
     * @inheritDoc
     */
    getData() {
        return {
            id: this.id,
            ip: this.ip,
            port: this.port,
            version: this.version,
            path: this.path,
            online: this.online,
            protocol: this.protocol,
            username: this.username,
            password: this.password,
            hash: this.hash,
            channels: this.channels
        };
    }
}

module.exports = ServerConnection;
