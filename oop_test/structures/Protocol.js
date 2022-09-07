const { Base } = require('discord.js');

/**
 * Paths to minecraft server files.
 * @type {function}
 */
const FilePath = {
    Advancements: (worldPath, uuid) => `${worldPath}/advancements/${uuid}.json`,
    Stats: (worldPath, uuid) => `${worldPath}/stats/${uuid}.json`,
    PlayerData: (worldPath, uuid) => `${worldPath}/playerdata/${uuid}.dat`,
    Properties: worldPath => `${worldPath}/server.properties`,
};

class Protocol extends Base {

    /**
     * @typedef {PluginProtocolData|FtpProtocolData} ProtocolData - The data for a protocol.
     */

    /**
     * @typedef {object} FileData
     * @property {string} name - The name of the file.
     * @property {boolean} isDirectory - Whether the file is a directory.
     */

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     */
    constructor(client) {
        super(client);
    }

    /**
     * Gets a file from the server.
     * @param {string} getPath - The remote path where the file is located.
     * @param {string} putPath - The local path where the file should be written.
     * @abstract
     */
    async get(getPath, putPath) {
        throw new Error('Not implemented');
    }

    /**
     * Puts a file onto the server.
     * @param {string} getPath - The local path where the file is located.
     * @param {string} putPath - The remote path where the file should be written.
     * @abstract
     */
    async put(getPath, putPath) {
        throw new Error('Not implemented');
    }

    /**
     * Connects to the server.
     * @abstract
     */
    async connect() {
        throw new Error('Not implemented');
    }

    /**
     * Patches the protocol with the given data.
     * @param {string} folder - The folder to list the files from.
     * @abstract
     */
    async list(folder) {
        throw new Error('Not implemented');
    }

    /**
     * Tests the connection to the server with the given credentials.
     * @param {ProtocolData} data - The data to test the connection with.
     * @returns {Promise<boolean>} - Whether the connection was successful.
     * @abstract
     */
    static testConnection(data) {
        throw new Error('Not implemented');
    }
}

module.exports = Protocol;
module.exports = { FilePath };
