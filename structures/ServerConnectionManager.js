const ServerConnection = require('./ServerConnection');
const ConnectionManager = require('./ConnectionManager');
const fs = require('fs-extra');

class ServerConnectionManager extends ConnectionManager {

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, outputPath = './serverdata/connections') {
        super(client, ServerConnection, outputPath);
    }

    /**
     * @inheritDoc
     */
    async _load() {
        await super._load();

        for(const connection of this.cache.values()) {
            const settings = await fs.readFile(`${this.outputPath}/${connection.id}/settings.json`, 'utf8');
            await connection.settings._patch(JSON.parse(settings));
        }
    }
}

module.exports = ServerConnectionManager;
