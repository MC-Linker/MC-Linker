import UserSettingsConnection from './UserSettingsConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class UserSettingsConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserSettingsConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {UserSettingsConnectionManager} - A new UserSettingsConnectionManager instance.
     */
    constructor(client, outputPath = './userdata/connections') {
        super(client, UserSettingsConnection, outputPath, 'settings.json');
    }
}
