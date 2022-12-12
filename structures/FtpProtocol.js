import Protocol from './Protocol.js';
import FtpClient from './ftp/FtpClient.js';
import SftpClient from './ftp/SftpClient.js';
import fs from 'fs-extra';

export default class FtpProtocol extends Protocol {

    /**
     * @typedef {object} FtpProtocolData
     * @property {string} ip - The ip the ftp server is listening on.
     * @property {number} port - The port the ftp server is listening on.
     * @property {string} username - The username used to authenticate with ftp.
     * @property {string} password - The password used to authenticate with ftp.
     * @property {boolean} sftp - Whether to use sftp or ftp.
     */

    /**
     * The client used to connect to the ftp server.
     * @type {FtpClient|SftpClient}
     */
    ftpClient;

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

    get sftp() {
        return this.ftpClient instanceof SftpClient;
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

        /**
         * Indicates whether batch mode is currently enabled.
         */
        this.batchMode = false;
    }

    set sftp(bool) {
        const credentials = { ip: this.ip, port: this.port, username: this.username, password: this.password };
        //set the ftp client to the correct type if it is different
        if(bool && !(this.ftpClient instanceof SftpClient)) this.ftpClient = new SftpClient(credentials);
        else if(!bool && !(this.ftpClient instanceof FtpClient)) this.ftpClient = new FtpClient(credentials);
    }

    static dataToProtocolResponse(data, status = 200) {
        if(data instanceof Error) {
            if(data.message.toLowerCase().includes('no such file')) status = 404;
            else return null;
            return { status, data: { message: data.message } };
        }

        if(data === null || data === undefined || data === false) return null;
        return { data, status };
    }

    /**
     * @inheritDoc
     * @returns {Promise<?ProtocolResponse>} - The response from the server.
     */
    async connect() {
        try {
            await this.ftpClient.connect();
            await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse({});
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
            if(!this.batchMode) await this.ftpClient.connect();
            await this.ftpClient.get(getPath, putPath);
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse(await fs.readFile(putPath));
        }
        catch(e) {
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async list(folder) {
        try {
            if(!this.batchMode) await this.ftpClient.connect();
            const list = await this.ftpClient.list(folder);
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse(list);
        }
        catch(e) {
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async put(getPath, putPath) {
        try {
            if(!this.batchMode) await this.ftpClient.connect();
            await this.ftpClient.put(getPath, putPath);
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse({});
        }
        catch(e) {
            if(!this.batchMode) await this.ftpClient.disconnect();
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
            if(!this.batchMode) await this.ftpClient.connect();
            const foundFile = await this.ftpClient.find(name, start, maxDepth);
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse(foundFile);
        }
        catch(e) {
            if(!this.batchMode) await this.ftpClient.disconnect();
            return FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async startBatch() {
        try {
            await this.ftpClient.connect();
            this.batchMode = true;
            return FtpProtocol.dataToProtocolResponse({});
        }
        catch(e) {
            FtpProtocol.dataToProtocolResponse(e);
        }
    }

    /**
     * @inheritDoc
     */
    async endBatch() {
        try {
            await this.ftpClient.disconnect();
            this.batchMode = false;
            return FtpProtocol.dataToProtocolResponse({});
        }
        catch(e) {
            FtpProtocol.dataToProtocolResponse(e);
        }
    }
}
