import { Base } from 'discord.js';

/**
 * Paths to minecraft server files.
 * @type {object}
 */
export const FilePath = {
    /**
     * Constructs the path to the user's advancements file.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @param {?string} [userId=null] - The user's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/advancements/${string}.json`} - The path to the advancements file.
     */
    Advancements: (worldPath, uuid, userId = null) => {
        const advancementPath = `${worldPath}/advancements/${uuid}.json`;
        return userId ? [advancementPath, `./userdata/connections/${userId}/advancements.json`] : `${worldPath}/advancements/${uuid}.json`;
    },
    /**
     * Constructs the path to the user's stats file.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @param {?string} [userId=null] - The user's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/stats/${string}.json`} - The path to the stats file.
     */
    Stats: (worldPath, uuid, userId) => {
        const statPath = `${worldPath}/stats/${uuid}.json`;
        return userId ? [statPath, `./userdata/connections/${userId}/stats.json`] : `${worldPath}/stats/${uuid}.json`;
    },
    /**
     * Constructs the path to the user's playerdata folder.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @param {?string} [userId=null] - The user's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/playerdata/${string}.dat`} - The path to the playerdata folder.
     */
    PlayerData: (worldPath, uuid, userId) => {
        const playerdataPath = `${worldPath}/playerdata/${uuid}.dat`;
        return userId ? [playerdataPath, `./userdata/connections/${userId}/playerdata.dat`] : `${worldPath}/playerdata/${uuid}.dat`;
    },

    /**
     * Constructs the path to the world's level.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/level.dat`} - The path to the world's level.dat file.
     */
    LevelDat: (worldPath, serverId) => {
        const leveldatPath = `${worldPath}/level.dat`;
        return serverId ? [leveldatPath, `./serverdata/connections/${serverId}/level.dat`] : `${worldPath}/level.dat`;
    },

    /**
     * Constructs the path to the world's scoreboard.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/data/scoreboard.dat`}
     */
    Scoreboards: (worldPath, serverId) => {
        const scoreboardsPath = `${worldPath}/data/scoreboard.dat`;
        return serverId ? [scoreboardsPath, `./serverdata/connections/${serverId}/scoreboard.dat`] : `${worldPath}/data/scoreboard.dat`;
    },

    /**
     * Constructs the path to the server's server.properties file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/server.properties`} - The path to the server's server.properties file.
     */
    ServerProperties: (serverPath, serverId) => {
        const serverPropertiesPath = `${serverPath}/server.properties`;
        return serverId ? [serverPropertiesPath, `./serverdata/connections/${serverId}/server.properties`] : `${serverPath}/server.properties`;
    },

    /**
     * Constructs the path to the server's server-icon.png file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/server-icon.png`} - The path to the server's server-icon.png file.
     */
    ServerIcon: (serverPath, serverId) => {
        const servericonPath = `${serverPath}/server-icon.png`;
        return serverId ? [servericonPath, `./serverdata/connections/${serverId}/server-icon.png`] : `${serverPath}/server-icon.png`;
    },

    /**
     * Constructs the path to the server's whitelist.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/whitelist.json`} - The path to the server's whitelist.json file.
     */
    Whitelist: (serverPath, serverId) => {
        const whitelistPath = `${serverPath}/whitelist.json`;
        return serverId ? [whitelistPath, `./serverdata/connections/${serverId}/whitelist.json`] : `${serverPath}/whitelist.json`;
    },

    /**
     * Constructs the path to the server's ops.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/ops.json`} - The path to the server's ops.json file.
     */
    Operators: (serverPath, serverId) => {
        const operatorsPath = `${serverPath}/ops.json`;
        return serverId ? [operatorsPath, `./serverdata/connections/${serverId}/ops.json`] : `${serverPath}/ops.json`;
    },

    /**
     * Constructs the path to the server's banned-players.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/banned-players.json`} - The path to the server's banned-players.json file.
     */
    BannedPlayers: (serverPath, serverId) => {
        const bannedplayersPath = `${serverPath}/banned-players.json`;
        return serverId ? [bannedplayersPath, `./serverdata/connections/${serverId}/banned-players.json`] : `${serverPath}/banned-players.json`;
    },

    /**
     * Constructs the path to the server's banned-ips.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/banned-ips.json`} - The path to the server's banned-ips.json file.
     */
    BannedIPs: (serverPath, serverId) => {
        const bannedIpsPath = `${serverPath}/banned-ips.json`;
        return serverId ? [bannedIpsPath, `./serverdata/connections/${serverId}/banned-ips.json`] : `${serverPath}/banned-ips.json`;
    },

    /**
     * Constructs the path to the server's plugins folder.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/plugins`} - The path to the server's plugins folder.
     */
    Plugins: (serverPath, serverId) => {
        const pluginsPath = `${serverPath}/plugins`;
        return serverId ? [pluginsPath, `./serverdata/connections/${serverId}/plugins`] : `${serverPath}/plugins`;
    },

    /**
     * Constructs the path to the server's mods folder.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/mods`} - The path to the server's mods folder.
     */
    Mods: (serverPath, serverId) => {
        const modsPath = `${serverPath}/mods`;
        return serverId ? [modsPath, `./serverdata/connections/${serverId}/mods`] : `${serverPath}/mods`;
    },

    /**
     * Constructs the path to the server's datapacks folder.
     * @param {string} worldPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/datapacks`} - The path to the server's datapacks folder.
     */
    DataPacks: (worldPath, serverId) => {
        const datapacksPath = `${worldPath}/datapacks`;
        return serverId ? [datapacksPath, `./serverdata/connections/${serverId}/datapacks`] : `${worldPath}/datapacks`;
    },
};

/**
 * @typedef {HttpProtocol|WebSocketProtocol} PluginProtocol - A protocol that uses the plugin for communication.
 */

export default class Protocol extends Base {

    /**
     * @typedef {HttpProtocolData|FtpProtocolData} ProtocolData - The data for a protocol.
     */

    /**
     * @typedef {object} FileData
     * @property {string} name - The name of the file.
     * @property {boolean} isDirectory - Whether the file is a directory.
     */

    /**
     * @typedef {object} ProtocolResponse - The response from a protocol call.
     * @property {any} data - The data of the response.
     * @property {number} status - The http status code of the response.
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
     * @returns {Promise<?ProtocolResponse & { data: Buffer }>} - The response from the server.
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

    /**
     * Starts a batch protocol interaction with the server allowing multiple requests to be sent at once.
     * @returns {Promise<ProtocolResponse>}
     */
    async startBatch() {
        return { data: null, status: 200 };
    }

    /**
     * Ends a batch protocol interaction with the server.
     * @returns {Promise<ProtocolResponse>}
     */
    async endBatch() {
        return { data: null, status: 200 };
    }


    //The following type guards use `Object.constructor.name` instead of `instanceof` to check the type of the protocol.
    //This is to prevent circular dependencies between the protocols and the protocol manager.

    /**
     * Checks whether this protocol is communicating over ftp.
     * @returns {this is FtpProtocol}
     */
    isFtpProtocol() {
        return this.constructor.name === 'FtpProtocol';
    }

    /**
     * Checks whether this protocol is communicating over http.
     * @returns {this is HttpProtocol}
     */
    isHttpProtocol() {
        return this.constructor.name === 'HttpProtocol';
    }

    /**
     * Checks whether this protocol is communicating over websockets.
     * @returns {this is WebSocketProtocol}
     */
    isWebSocketProtocol() {
        return this.constructor.name === 'WebSocketProtocol';
    }

    /**
     * Checks whether this protocol is communicating with a plugin.
     * @returns {this is HttpProtocol | WebSocketProtocol}
     */
    isPluginProtocol() {
        return this.isHttpProtocol() || this.isWebSocketProtocol();
    }
}
