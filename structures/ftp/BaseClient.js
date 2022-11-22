export default class BaseClient {

    /**
     * @typedef {object} Credentials
     * @property {string} host - The ip the ftp server is listening on.
     * @property {number} port - The port the ftp server is listening on.
     * @property {string?} username - The username used to authenticate with ftp or sftp.
     * @property {string?} user - The username used to authenticate with ftp or sftp.
     * @property {string} password - The password used to authenticate with ftp or sftp.
     *
     * @property {string?} ip - The ip the ftp server is listening on.
     */

    /**
     * @typedef {object} FileData
     * @property {string} name - The name of the file.
     * @property {boolean} isDirectory - Whether the file is a directory.
     */

    /**
     * Creates a new ftp or sftp instance.
     * @param {Credentials} credentials - The credentials for the connection.
     * @returns {import('ftp') | import('ssh2-sftp-client')} - The ftp or sftp instance.
     */
    constructor(credentials) {

        /**
         * The credentials for the connection.
         * @type {Credentials}
         */
        this.credentials = credentials;
    }

    /**
     * Tests the connection to the ftp server.
     * @returns {Promise<boolean>} - Whether the connection was successful.
     * @abstract
     */
    connect() {
        throw new Error('Not implemented.');
    }

    /**
     * Gets a file from the server.
     * @param {string} source - The source (remote) path of the file.
     * @param {string} destination - The destination (local) path of the file.
     * @returns {Promise<boolean>} - Whether the file was successfully got.
     * @abstract
     */
    get(source, destination) {
        throw new Error('Not implemented.');
    }

    /**
     * Puts a file onto the server.
     * @param {string} source - The source (local) path of the file.
     * @param {string} destination - The destination (remote) path of the file.
     * @returns {Promise<boolean>} - Whether the file was successfully put.
     * @abstract
     */
    put(source, destination) {
        throw new Error('Not implemented.');
    }

    /**
     * Lists the files in the given remote folder.
     * @param {string} folder - The path to the folder to list the files from.
     * @returns {Promise<FileData[]>} - The files in the given folder.
     * @abstract
     */
    list(folder) {
        throw new Error('Not implemented.');
    }

    /**
     * Finds a file on the server.
     * @param {string} name - The name of the file to find.
     * @param {string} start - The folder to start the search from.
     * @param {number} maxDepth - The maximum depth to search.
     * @returns {Promise<?string>} - The path to the file.
     * @abstract
     */
    find(name, start, maxDepth) {
        throw new Error('Not implemented.');
    }

    /**
     * Finds a file recursively on the server.
     * @param {string} name - The name of the file to find.
     * @param {string} path - The path to start searching from.
     * @param {number} maxDepth - The maximum depth to search.
     * @returns {Promise<?string>} - The path to the file.
     * @abstract
     * @private
     */
    _findFile(name, path, maxDepth) {
        throw new Error('Not implemented.');
    }
}
