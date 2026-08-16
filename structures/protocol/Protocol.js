import { Base } from 'discord.js';
import fs from 'fs-extra';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.structures.protocol.websocket });

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
    /** An I/O error occurred (file read/write, connection file, etc.). */
    IO_ERROR: 'io_error',
    /** The received Socket.IO event is not recognized. */
    UNKNOWN_EVENT: 'unknown_event',
    /** Could not retrieve NBT data for the player. */
    NBT_ERROR: 'nbt_error',
    /** The connection configuration file is missing. */
    CONN_JSON_MISSING: 'conn_json_missing',
    /** Target Discord user has DMs disabled. */
    DM_CLOSED: 'dm_closed',
    /** Target Discord user has blocked DMs from Minecraft (user preference). */
    DM_BLOCKED: 'dm_blocked',
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
     * Checks if the protocol is currently connected.
     * @returns {boolean} - Whether the protocol is connected.
     */
    isConnected() {
        return false;
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
     * Gets a file from the server with cache fallback.
     * If the server is not connected, attempts to read the file from the local cache.
     * If the server is connected but the request fails, also falls back to the cache.
     * @param {string} getPath - The remote path where the file is located.
     * @param {string} putPath - The local path where the file should be written / read from cache.
     * @returns {Promise<?ProtocolResponse & { data: Buffer, cached: boolean }>} - The response, with a `cached` flag indicating if the data came from the local cache. Returns null if both live and cache fail.
     */
    async getWithCache(getPath, putPath) {
        if(this.isConnected()) {
            const response = await this.get(getPath, putPath);
            if(response?.status === 'success') return { ...response, cached: false };

            // Live request failed — try cache fallback
            try {
                const buffer = await fs.readFile(putPath);
                logger.debug(`Live request failed for ${getPath}, serving cached file from ${putPath}`);
                return { status: 'success', data: buffer, cached: true };
            }
            catch {
                // No cache available either — return original failed response
                return response;
            }
        }

        // Not connected — try cache
        try {
            const buffer = await fs.readFile(putPath);
            logger.debug(`Server offline, serving cached file from ${putPath}`);
            return { status: 'success', data: buffer, cached: true };
        }
        catch {
            return null;
        }
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
