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

    /**
     * @inheritDoc
     */
    static async testConnection(data) {
        const ftpClient = data.sftp ? new SftpClient(data) : new FtpClient(data);
        return await ftpClient.connect();
    }

    static dataToProtocolResponse(data, status = 200) {
        if(data instanceof Error) {
            if(data.message.toLowerCase().includes('no such file')) status = 404;
            else return null;
            return { status, data: { message: data.message } };
        }

        if(!data) return null;
        return { data, status };
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

    set sftp(bool) {
        const credentials = { ip: this.ip, port: this.port, username: this.username, password: this.password };
        //set the ftp client to the correct type if it is different
        if(bool && !(this.ftpClient instanceof SftpClient)) this.ftpClient = new SftpClient(credentials);
        else if(!bool && !(this.ftpClient instanceof FtpClient)) this.ftpClient = new FtpClient(credentials);
    }

    /**
     * @inheritDoc
     * @returns {Promise<?ProtocolResponse>} - The response from the server.
     */
    async connect() {
        try {
            await this.ftpClient.connect();
            return FtpProtocol.dataToProtocolResponse({ message: 'Success' });
        }
        catch(e) {
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async get(getPath, putPath) {
        try {
            await this.ftpClient.get(getPath, putPath);
            return FtpProtocol.dataToProtocolResponse(await fs.readFile(putPath));
        }
        catch(e) {
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async list(folder) {
        try {
            const list = await this.ftpClient.list(folder);
            return FtpProtocol.dataToProtocolResponse(list);
        }
        catch(e) {
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async put(getPath, putPath) {
        try {
            return FtpProtocol.dataToProtocolResponse(await this.ftpClient.put(getPath, putPath));
        }
        catch(e) {
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * Finds a file on the server.
     * @param {string} name - The name of the file to search for.
     * @param {string} start - The folder to start searching in.
     * @param {number} maxDepth - The maximum depth to search.
     * @returns {Promise<?ProtocolResponse>} - The path to the file.
     */
    async find(name, start, maxDepth) {
        try {
            return FtpProtocol.dataToProtocolResponse(await this.ftpClient.find(name, start, maxDepth));
        }
        catch(e) {
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }
}

module.exports = FtpProtocol;
