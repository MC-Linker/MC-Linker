import ServerConnection from './ServerConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class ServerConnectionManager extends ConnectionManager {

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, collectionName = 'ServerConnection') {
        super(client, ServerConnection, collectionName);
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
}
