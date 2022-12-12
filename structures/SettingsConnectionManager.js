import SettingsConnection from './SettingsConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class SettingsConnectionManager extends ConnectionManager {

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {SettingsConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, outputPath = './serverdata/connections') {
        super(client, SettingsConnection, outputPath, 'settings.json');
    }

    /**
     * @inheritDoc
     */
    async _load() {
        await super._load();

        //If server connections are loaded, load the settings for each server.
        if(!this.client.serverConnections.cache.size) return;

        for(const connection of this.cache.values()) {
            const server = this.client.serverConnections.cache.get(connection.id);
            if(server) server.settings = connection;
        }
    }
}
