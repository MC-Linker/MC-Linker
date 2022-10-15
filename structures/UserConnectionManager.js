const UserConnection = require('./UserConnection');
const ConnectionManager = require('./ConnectionManager');
const { fetchUUID } = require('../api/utils');
const Discord = require('discord.js');

class UserConnectionManager extends ConnectionManager {

    /**
     * The user connection cache of this manager.
     * @type {Map<string, UserConnection>}
     */
    cache;

    /**
     * Creates a new UserConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write user data to.
     * @returns {UserConnectionManager} - A new UserConnectionManager instance.
     */
    constructor(client, outputPath = './userdata/connections') {
        super(client, UserConnection, outputPath, 'connection.json');
        this.cache = super.cache;
    }

    /**
     * @typedef {object} UserResponse
     * @property {?string} uuid - The uuid of the user.
     * @property {?string} username - The username of the user.
     * @property {?'nullish'|?'fetch'|?'cache'} error - The error that occurred.
     */

    /**
     * Returns the uuid and name of a user from a mention/username.
     * @param {string} arg - The argument to get the uuid and name from.
     * @param {ServerConnectionResolvable} server - The server to resolve the uuid and name from.
     * @returns {Promise<UserResponse>} - The uuid and name of the user.
     */
    async userFromArgument(arg, server) {
        if(!arg) return { error: 'nullish', uuid: null, username: null };

        const id = Discord.MessageMentions.UsersPattern.exec(arg)?.[1];
        if(id) {
            const cacheConnection = this.cache.get(id);
            if(cacheConnection) return {
                uuid: cacheConnection.getUUID(server),
                username: cacheConnection.username,
                error: null,
            };
            return { error: 'cache', uuid: null, username: null };
        }

        const apiUUID = await fetchUUID(arg);
        if(apiUUID) return { uuid: apiUUID, username: arg, error: null };
        return { error: 'fetch', uuid: null, username: null };
    }
}

module.exports = UserConnectionManager;
