const Protocol = require('./Protocol');

class FtpProtocol extends Protocol {

    /**
     * @typedef {object} FtpProtocolData
     * @property {string} ip - The ip the ftp server is listening on.
     * @property {number} port - The port the ftp server is listening on.
     * @property {string} username - The username used to authenticate with ftp.
     * @property {string} password - The password used to authenticate with ftp.
     * @property {boolean} sftp - Whether to use sftp or ftp.
     */

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     * @param {FtpProtocolData} data - The data for the protocol.
     */
    constructor(client, data) {
        super(client);

        this._patch(data);
    }

    _patch(data) {

        /**
         * The ip the ftp server is listening on.
         * @type {string}
         */
        this.ip = data.ip ?? this.ip;

        /**
         * The port the ftp server is listening on.
         * @type {number}
         */
        this.port = data.port ?? this.port;

        /**
         * The username used to authenticate with ftp.
         * @type {string}
         */
        this.username = data.username ?? this.username;

        /**
         * The password used to authenticate with ftp.
         * @type {string}
         */
        this.password = data.password ?? this.password;
    }

    /**
     * @inheritDoc
     */
    async connect() {
        return Promise.resolve(false);
    }

    /**
     * @inheritDoc
     */
    async get() {
        return Promise.resolve(undefined);
    }

    /**
     * @inheritDoc
     */
    async list() {
        return Promise.resolve([]);
    }

    /**
     * @inheritDoc
     */
    async put() {
        return Promise.resolve(false);
    }

    /**
     * Finds a file on the server.
     * @returns {Promise<string>} - The path to the file.
     */
    async find() {

    }
}


module.exports = FtpProtocol;
