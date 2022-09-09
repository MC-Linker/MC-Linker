const UserConnection = require('./UserConnection');
const ConnectionManager = require('./ConnectionManager');

class UserConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write user data to.
     * @returns {UserConnectionManager} - A new UserConnectionManager instance.
     */
    constructor(client, outputPath = './userdata/connections') {
        super(client, UserConnection, outputPath);
    }

    /**
     * The user connection cache of this manager.
     * @type {Map<string, UserConnection>}
     */
    cache;
}

module.exports = UserConnectionManager;
