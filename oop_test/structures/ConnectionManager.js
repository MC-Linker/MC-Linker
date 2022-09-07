const { CachedManager } = require('discord.js');
const fs = require('fs-extra');

class ConnectionManager extends CachedManager {

    /**
     * Creates a new ConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {ServerConnection|UserConnection} holds - The type of connection the manager holds.
     * @param {string} outputPath - The path to write server data to.
     * @returns {ConnectionManager} - A new ConnectionManager instance.
     */
    constructor(client, holds, outputPath) {
        super(client, holds);

        /**
         * The path to write server data to.
         * @type {string}
         */
        this.outputPath = outputPath;
    }

    /**
     * Adds a connection to the cache and writes the data to the file system.
     * @param {ServerConnectionData|UserConnectionData} data - The data for the connection.
     * @returns {Promise<?ServerConnection|?UserConnection>} - The connection instance that has been created.
     */
    async connect(data) {
        /** @type {?ServerConnection|?UserConnection} */
        const connection = this._add(data, true, { extras: [this.outputPath] });
        if(connection && await connection.output()) return connection;
        else {
            this.cache.delete(this.resolveId(connection));
            return null;
        }
    }

    /**
     * Removes a connection from the cache and deletes the data from the file system.
     * @param {ServerConnectionResolvable|UserConnectionResolvable} connection - The connection to disconnect.
     * @returns {Promise<boolean>} - Whether the disconnection was successful.
     */
    async disconnect(connection) {
        /** @type {?ServerConnection|?UserConnection} */
        const instance = this.resolve(connection);
        if(instance && await instance._delete()) {
            return this.cache.delete(this.resolveId(connection));
        }
        else return false;
    }

    async load() {
        const connections = await fs.readdir(this.outputPath);
        for(const connectionFile of connections) {
            const connection = await fs.readFile(`${this.outputPath}/${connectionFile}/connection.json`, 'utf8');
            await this.connect(JSON.parse(connection));
            //TODO FIX SETTINGS LOAD
        }
    }
}

module.exports = ConnectionManager;
