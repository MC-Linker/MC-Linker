import ServerConnection from './ServerConnection.js';
import ConnectionManager from './ConnectionManager.js';
import fs from 'fs-extra';

export default class ServerConnectionManager extends ConnectionManager {

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, outputPath = './serverdata/connections') {
        super(client, ServerConnection, outputPath, 'connection.json');
    }

    /**
     * @inheritDoc
     */
    async _load() {
        await super._load();

        //If settings connections are loaded, load the settings for each server.
        if(!this.client.serverSettingsConnections.cache.size) return;

        for(const connection of this.cache.values()) {
            const settings = this.client.serverSettingsConnections.cache.get(connection.id);
            if(settings) connection.settings = settings;
        }
    }

    async removeDataFolder(guildId) {
        try {
            await fs.rm(`${this.outputPath}/${guildId}/`, { recursive: true });
            return true;
        }
        catch(_) {
            return false;
        }
    }
}
