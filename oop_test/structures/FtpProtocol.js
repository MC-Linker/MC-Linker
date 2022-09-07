const Protocol = require('./Protocol');
const FtpClient = require('./ftp/FtpClient');
const SftpClient = require('./ftp/SftpClient');
const fs = require('fs-extra');

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

        /**
         * Whether to use sftp or ftp.
         * @type {boolean}
         */
        this.sftp = data.sftp ?? this.sftp;

        const credentials = { ip: this.ip, port: this.port, username: this.username, password: this.password };

        /**
         * The client used to connect to the ftp server.
         * @type {FtpClient|SftpClient}
         */
        this.ftpClient = this.sftp ? new SftpClient(credentials) : new FtpClient(credentials);
    }

    /**
     * @inheritDoc
     */
    async connect() {
        return await this.ftpClient.connect();
    }

    /**
     * @inheritDoc
     * @returns {Promise<?Buffer>} - The file data.
     */
    async get(getPath, putPath) {
        if(await this.ftpClient.get(getPath, putPath)) {
            return await fs.readFile(putPath);
        } else return null;
    }

    /**
     * @inheritDoc
     * @returns {Promise<FileData[]>} - The files in the given folder.
     */
    async list(folder) {
        return await this.ftpClient.list(folder);
    }

    /**
     * @inheritDoc
     * @returns {Promise<boolean>} - Whether the file was successfully put.
     */
    async put(getPath, putPath) {
        return await this.ftpClient.put(getPath, putPath);
    }

    /**
     * Finds a file on the server.
     * @param {string} name - The name of the file to search for.
     * @param {string} start - The folder to start searching in.
     * @param {number} maxDepth - The maximum depth to search.
     * @returns {Promise<?string>} - The path to the file.
     */
    async find(name, start, maxDepth) {
        return await this.ftpClient.find(name, start, maxDepth);

    }

    /**
     * @inheritDoc
     */
    static async testConnection(data) {
        try {
            const ftpClient = data.sftp ? new SftpClient(data) : new FtpClient(data);
            return await ftpClient.connect();
        } catch (e) {
            return false;
        }
    }
}


module.exports = FtpProtocol;
