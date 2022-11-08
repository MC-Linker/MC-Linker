const { Base } = require('discord.js');

/**
 * Paths to minecraft server files.
 * @type {object}
 */
const FilePath = {
    /**
     * Constructs the path to the user's advancements file.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @returns {`${string}/advancements/${string}.json`} - The path to the advancements file.
     */
    Advancements: (worldPath, uuid) => `${worldPath}/advancements/${uuid}.json`,
    /**
     * Constructs the path to the user's stats file.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @returns {`${string}/stats/${string}.json`} - The path to the stats file.
     */
    Stats: (worldPath, uuid) => `${worldPath}/stats/${uuid}.json`,
    /**
     * Constructs the path to the user's playerdata folder.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @returns {`${string}/playerdata/${string}.dat`} - The path to the playerdata folder.
     */
    PlayerData: (worldPath, uuid) => `${worldPath}/playerdata/${uuid}.dat`,

    /**
     * Constructs the path to the world's level.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @returns {`${string}/level.dat`} - The path to the world's level.dat file.
     */
    LevelDat: worldPath => `${worldPath}/level.dat`,

    /**
     * Constructs the path to the world's scoreboard.dat file.
     * @param worldPath
     * @returns {`${string}/data/scoreboard.dat`}
     */
    Scoreboards: worldPath => `${worldPath}/data/scoreboard.dat`,

    /**
     * Constructs the path to the server's server.properties file.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/server.properties`} - The path to the server's server.properties file.
     */
    ServerProperties: serverPath => `${serverPath}/server.properties`,

    /**
     * Constructs the path to the server's server-icon.png file.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/server-icon.png`} - The path to the server's server-icon.png file.
     */
    ServerIcon: serverPath => `${serverPath}/server-icon.png`,

    /**
     * Constructs the path to the server's whitelist.json file.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/whitelist.json`} - The path to the server's whitelist.json file.
     */
    Whitelist: serverPath => `${serverPath}/whitelist.json`,

    /**
     * Constructs the path to the server's ops.json file.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/ops.json`} - The path to the server's ops.json file.
     */
    Operators: serverPath => `${serverPath}/ops.json`,

    /**
     * Constructs the path to the server's banned-players.json file.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/banned-players.json`} - The path to the server's banned-players.json file.
     */
    BannedPlayers: serverPath => `${serverPath}/banned-players.json`,

    /**
     * Constructs the path to the server's banned-ips.json file.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/banned-ips.json`} - The path to the server's banned-ips.json file.
     */
    BannedIPs: serverPath => `${serverPath}/banned-ips.json`,

    /**
     * Constructs the path to the server's plugins folder.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/plugins`} - The path to the server's plugins folder.
     */
    Plugins: serverPath => `${serverPath}/plugins`,

    /**
     * Constructs the path to the server's mods folder.
     * @param {string} serverPath - The path to the server folder.
     * @returns {`${string}/mods`} - The path to the server's mods folder.
     */
    Mods: serverPath => `${serverPath}/mods`,
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
     * @typedef {object} ProtocolResponse - The response from a protocol call.
     * @property {any} data - The data of the response.
     * @property {number} [status] - The http status code of the response (only for plugin protocols).
     */

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     */
    constructor(client) {
        super(client);
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

    /**
     * Gets a file from the server.
     * @param {string} getPath - The remote path where the file is located.
     * @param {string} putPath - The local path where the file should be written.
     * @returns {Promise<?ProtocolResponse>} - The response from the server.
     * @abstract
     */
    async get(getPath, putPath) {
        throw new Error('Not implemented');
    }

    /**
     * Puts a file onto the server.
     * @param {string} getPath - The local path where the file is located.
     * @param {string} putPath - The remote path where the file should be written.
     * @returns {Promise<?ProtocolResponse>} - The response from the server.
     * @abstract
     */
    async put(getPath, putPath) {
        throw new Error('Not implemented');
    }

    /**
     * Lists the files in a directory on the server.
     * @param {string} folder - The folder to list the files from.
     * @returns {Promise<Omit<?ProtocolResponse, 'data'> & { data: FileData[] }>} - The files in the folder.
     * @abstract
     */
    async list(folder) {
        throw new Error('Not implemented');
    }
}

module.exports = Protocol;
module.exports.FilePath = FilePath;
