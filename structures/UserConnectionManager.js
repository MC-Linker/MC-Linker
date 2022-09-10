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
    }

    /**
     * The user connection cache of this manager.
     * @type {Map<string, UserConnection>}
     */
    cache;

    /**
     * @typedef {object} UUIDResponse
     * @property {?string} uuid - The uuid of the user.
     * @property {?'nullish'|?'fetch'|?'cache'} error - The error that occurred.
     */

    /**
     * Returns the uuid of a user from a mention/username.
     * @param {string} arg - The argument to get the uuid from.
     * @returns {Promise<UUIDResponse>} - The uuid of the user, or undefined if no user was found.
     */
    async uuidFromArgument(arg) {
        if(!arg) return { error: 'nullish', uuid: undefined };

        let user = getUsersFromMention(this.client, arg);
        const cacheUUID = this.cache.get(user?.id)?.uuid;
        if(cacheUUID) return { uuid: cacheUUID, error: null };

        const apiUUID = await fetchUUID(arg);
        if(apiUUID) return { uuid: apiUUID, error: null };

        return { error: !cacheUUID ? 'cache' : 'fetch', uuid: null };
    }
}

module.exports = UserConnectionManager;
