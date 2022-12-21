import UserSettingsConnection from './UserSettingsConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class UserSettingsConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserSettingsConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {UserSettingsConnectionManager} - A new UserSettingsConnectionManager instance.
     */
    constructor(client, outputPath = './serverdata/connections') {
        super(client, UserSettingsConnection, outputPath, 'settings.json');
    }

    /**
     * @inheritDoc
     */
    async _load() {
        await super._load();

        //If user connections are loaded, load the settings for each server.
        if(!this.client.userConnections.cache.size) return;

        for(const connection of this.cache.values()) {
            const server = this.client.serverConnections.cache.get(connection.id);
            if(server) server.settings = connection;
        }
    }
}
