const ServerConnection = require('./ServerConnection');
const ConnectionManager = require('./ConnectionManager');

class ServerConnectionManager extends ConnectionManager {

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, outputPath = './serverdata/connections') {
        super(client, ServerConnection, outputPath, 'connection.json');
        this.cache = super.cache;
    }

    /**
     * The server connection cache of this manager.
     * @type {Map<string, ServerConnection>}
     */
    cache;

    /**
     * @inheritDoc
     */
    async _load() {
        await super._load();

        //If settings connections are loaded, load the settings for each server.
        if(!this.client.settingsConnections.cache.size) return;

        for(const connection of this.cache.values()) {
            const settings = this.client.settingsConnections.cache.get(connection.id);
            if(settings) connection.settings = settings;
        }
    }
}

module.exports = ServerConnectionManager;
