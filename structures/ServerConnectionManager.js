import ServerConnection from './ServerConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class ServerConnectionManager extends ConnectionManager {

    /**
     * @type {import('discord.js').Collection<string, ServerConnection>}
     */
    cache;

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, collectionName = 'ServerConnection') {
        super(client, ServerConnection, collectionName);

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, ServerConnection>}
         */
        this.cache = super.cache;
    }

    async disconnect(connectionResolvable) {
        /** @type {ServerConnection} */
        const connection = this.resolve(connectionResolvable);

        for(const channel of connection?.chatChannels ?? []) {
            if(channel.webhook) {
                try {
                    const webhook = await this.client.fetchWebhook(channel.webhook);
                    await webhook.delete();
                }
                catch(_) {}
            }
        }

        if(!await super.disconnect(connection)) return false;
        await connection.removeCache();
        return true;
    }

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
