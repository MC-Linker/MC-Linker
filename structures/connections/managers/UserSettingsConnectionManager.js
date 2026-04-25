import UserSettingsConnection from '../UserSettingsConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class UserSettingsConnectionManager extends ConnectionManager {

    /**
     * @type {import('discord.js').Collection<string, UserSettingsConnection>}
     */
    cache;

    /**
     * Creates a new UserSettingsConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {UserSettingsConnectionManager} - A new UserSettingsConnectionManager instance.
     */
    constructor(client, collectionName = 'UserSettingsConnection') {
        super(client, UserSettingsConnection, collectionName);

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, UserSettingsConnection>}
         */
        this.cache = super.cache;
    }

    /**
     * Gets a settings connection for the specified user. If none exists, one will be created.
     * @param {string} userId - The Discord user ID.
     * @returns {Promise<UserSettingsConnection>}
     */
    async getOrConnect(userId) {
        const connection = this.cache.get(userId);
        if(connection) return connection;

        return await this.connect({ id: userId });
    }
}
