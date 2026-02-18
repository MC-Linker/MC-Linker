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
        return userId ? [advancementPath, `./download-cache/userConnection/${userId}/advancements.json`] : advancementPath;
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
        return userId ? [statPath, `./download-cache/userConnection/${userId}/stats.json`] : statPath;
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
        return userId ? [playerdataPath, `./download-cache/userConnection/${userId}/playerdata.dat`] : playerdataPath;
    },

    /**
     * Constructs the path to the world's level.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/level.dat`} - The path to the world's level.dat file.
     */
    LevelDat: (worldPath, serverId) => {
        const levelDatPath = `${worldPath}/level.dat`;
        return serverId ? [levelDatPath, `./download-cache/serverConnection/${serverId}/level.dat`] : levelDatPath;
    },

    /**
     * Constructs the path to the world's scoreboard.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/data/scoreboard.dat`}
     */
    Scoreboards: (worldPath, serverId) => {
        const scoreboardsPath = `${worldPath}/data/scoreboard.dat`;
        return serverId ? [scoreboardsPath, `./download-cache/serverConnection/${serverId}/scoreboard.dat`] : scoreboardsPath;
    },

    /**
     * Constructs the path to the server's server.properties file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/server.properties`} - The path to the server's server.properties file.
     */
    ServerProperties: (serverPath, serverId) => {
        const serverPropertiesPath = `${serverPath}/server.properties`;
        return serverId ? [serverPropertiesPath, `./download-cache/serverConnection/${serverId}/server.properties`] : serverPropertiesPath;
    },

    /**
     * Constructs the path to the server's server-icon.png file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/server-icon.png`} - The path to the server's server-icon.png file.
     */
    ServerIcon: (serverPath, serverId) => {
        const serverIconPath = `${serverPath}/server-icon.png`;
        return serverId ? [serverIconPath, `./download-cache/serverConnection/${serverId}/server-icon.png`] : serverIconPath;
    },

    /**
     * Constructs the path to the server's whitelist.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/whitelist.json`} - The path to the server's whitelist.json file.
     */
    Whitelist: (serverPath, serverId) => {
        const whitelistPath = `${serverPath}/whitelist.json`;
        return serverId ? [whitelistPath, `./download-cache/serverConnection/${serverId}/whitelist.json`] : whitelistPath;
    },

    /**
     * Constructs the path to the server's ops.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/ops.json`} - The path to the server's ops.json file.
     */
    Operators: (serverPath, serverId) => {
        const operatorsPath = `${serverPath}/ops.json`;
        return serverId ? [operatorsPath, `./download-cache/serverConnection/${serverId}/ops.json`] : operatorsPath;
    },

    /**
     * Constructs the path to the server's banned-players.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/banned-players.json`} - The path to the server's banned-players.json file.
     */
    BannedPlayers: (serverPath, serverId) => {
        const bannedPlayersPath = `${serverPath}/banned-players.json`;
        return serverId ? [bannedPlayersPath, `./download-cache/serverConnection/${serverId}/banned-players.json`] : bannedPlayersPath;
    },

    /**
     * Constructs the path to the server's banned-ips.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/banned-ips.json`} - The path to the server's banned-ips.json file.
     */
    BannedIPs: (serverPath, serverId) => {
        const bannedIpsPath = `${serverPath}/banned-ips.json`;
        return serverId ? [bannedIpsPath, `./download-cache/serverConnection/${serverId}/banned-ips.json`] : bannedIpsPath;
    },

    /**
     * Constructs the path to the server's plugins folder.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/plugins`} - The path to the server's plugins folder.
     */
    Plugins: (serverPath, serverId) => {
        const pluginsPath = `${serverPath}/plugins`;
        return serverId ? [pluginsPath, `./download-cache/serverConnection/${serverId}/plugins`] : pluginsPath;
    },

    /**
     * Constructs the path to the server's mods folder.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/mods`} - The path to the server's mods folder.
     */
    Mods: (serverPath, serverId) => {
        const modsPath = `${serverPath}/mods`;
        return serverId ? [modsPath, `./download-cache/serverConnection/${serverId}/mods`] : modsPath;
    },

    /**
     * Constructs the path to the server's datapacks folder.
     * @param {string} worldPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/datapacks`} - The path to the server's datapacks folder.
     */
    DataPacks: (worldPath, serverId) => {
        const datapacksPath = `${worldPath}/datapacks`;
        return serverId ? [datapacksPath, `./download-cache/serverConnection/${serverId}/datapacks`] : datapacksPath;
    },
    /**
     * Constructs the path to the server's floodgate config file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/plugins/floodgate/config.yml`} - The path to the server's floodgate config file.
     */
    FloodgateConfig: (serverPath, serverId) => {
        const floodgateConfigPath = `${serverPath}/plugins/floodgate/config.yml`;
        return serverId ? [floodgateConfigPath, `./download-cache/serverConnection/${serverId}/floodgate-config.yml`] : floodgateConfigPath;
    },
};

/**
 * Standardized error codes for protocol responses.
 * @type {Readonly<Object.<string, string>>}
 */
export const ProtocolError = Object.freeze({
    /** Generic/unhandled client error. */
    UNKNOWN: 'unknown',
    /** Wrong authorization credentials. */
    UNAUTHORIZED: 'unauthorized',
    /** Requested resource/player/file not found. */
    NOT_FOUND: 'not_found',
    /** The targeted player is not online. */
    PLAYER_NOT_ONLINE: 'player_not_online',
    /** The LuckPerms plugin is not loaded on the server. */
    LUCKPERMS_NOT_LOADED: 'luckperms_not_loaded',
    /** The plugin did not respond (timeout or no connection). */
    NO_RESPONSE: 'no_response',
    /** Malformed JSON in event data. */
    INVALID_JSON: 'invalid_json',
    /** Request was rate-limited. */
    RATE_LIMITED: 'rate_limited',
    /** The user is not connected/linked. */
    NOT_CONNECTED: 'not_connected',
    /** The target group or team does not exist. */
    INVALID_GROUP_OR_TEAM: 'invalid_group_or_team',
    /** An I/O error occurred (file read/write, connection file, etc.). */
    IO_ERROR: 'io_error',
    /** The received Socket.IO event is not recognized. */
    UNKNOWN_EVENT: 'unknown_event',
    /** Could not retrieve NBT data for the player. */
    NBT_ERROR: 'nbt_error',
    /** The connection configuration file is missing. */
    CONN_JSON_MISSING: 'conn_json_missing',
});

export default class Protocol extends Base {

    /**
     * @typedef {WebSocketProtocolData} ProtocolData - The data for a protocol.
     */

    /**
     * @typedef {object} FileData
     * @property {string} name - The name of the file.
     * @property {boolean} isDirectory - Whether the file is a directory.
     */

    /**
     * @typedef {object} ProtocolResponse - The response from a protocol call.
     * @property {'success'|'error'} status - The status of the response.
     * @property {any} [data] - The data of the response.
     * @property {string} [error] - A snake_case error code (only present when status is 'error'). See {@link ProtocolError} for known codes.
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
        return { status: 'success', data: null };
    }

    /**
     * Ends a batch protocol interaction with the server.
     * @returns {Promise<ProtocolResponse>}
     */
    async endBatch() {
        return { status: 'success', data: null };
    }
}
