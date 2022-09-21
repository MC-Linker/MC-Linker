const UserConnection = require('./UserConnection');
const ConnectionManager = require('./ConnectionManager');
const { getUsersFromMention } = require('../api/messages');
const { fetchUUID } = require('../api/utils');

class UserConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write user data to.
     * @returns {UserConnectionManager} - A new UserConnectionManager instance.
     */
    constructor(client, outputPath = './userdata/connections') {
        super(client, UserConnection, outputPath);
        this.cache = super.cache;
    }

    /**
     * The user connection cache of this manager.
     * @type {Map<string, UserConnection>}
     */
    cache;

    /**
     * @typedef {object} ConnectionResponse
     * @property {?string} uuid - The uuid of the user.
     * @property {?string} username - The username of the user.
     * @property {?'nullish'|?'fetch'|?'cache'} error - The error that occurred.
     */

    /**
     * Returns the uuid of a user from a mention/username.
     * @param {string} arg - The argument to get the uuid from.
     * @param {ServerConnectionResolvable} server - The server to resolve the uuid from.
     * @returns {Promise<ConnectionResponse>} - The uuid of the user, or undefined if no user was found.
     */
    async playerFromArgument(arg, server) {
        if(!arg) return { error: 'nullish', uuid: null, username: null };

        let user = getUsersFromMention(this.client, arg);
        const cacheConnection = this.cache.get(user[0]?.id);
        if(cacheConnection) return { uuid: cacheConnection?.uuid, username: cacheConnection?.getUUID(server), error: null };

        const apiUUID = await fetchUUID(arg);
        if(apiUUID) return { uuid: apiUUID, username: arg, error: null };

        return { error: !cacheConnection ? 'cache' : 'fetch', uuid: null, username: null };
    }
}

module.exports = UserConnectionManager;
