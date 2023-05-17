import UserSettingsConnection from './UserSettingsConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class UserSettingsConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserSettingsConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {UserSettingsConnectionManager} - A new UserSettingsConnectionManager instance.
     */
    constructor(client, collectionName = 'UserSettingsConnection') {
        super(client, UserSettingsConnection, collectionName);
    }
}
