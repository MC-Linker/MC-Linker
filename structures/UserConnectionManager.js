import UserConnection from './UserConnection.js';
import ConnectionManager from './ConnectionManager.js';
import * as utils from '../utilities/utils.js';
import Discord from 'discord.js';
import keys from '../utilities/keys.js';

export default class UserConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {UserConnectionManager} - A new UserConnectionManager instance.
     */
    constructor(client, collectionName = 'UserConnection') {
        super(client, UserConnection, collectionName);
    }

    /**
     * @typedef {object} UserResponse
     * @property {?string} uuid - The uuid of the user.
     * @property {?string} username - The username of the user.
     * @property {?'nullish'|?'fetch'|?'cache'} error - The error that occurred.
     */

    /**
     * Returns the uuid and name of a minecraft user from a mention/username.
     * @param {string} arg - The argument to get the uuid and name from.
     * @param {ServerConnectionResolvable} server - The server to resolve the uuid and name from.
     * @param {TranslatedResponses} interaction - The interaction to reply to if the user is not connected.
     * @returns {Promise<UserResponse>} - The uuid and name of the user.
     */
    async userFromArgument(arg, server, interaction) {
        if(!arg) {
            await interaction.replyTl(keys.api.command.warnings.no_user);
            return { error: 'nullish', uuid: null, username: null };
        }

        const id = Discord.MessageMentions.UsersPattern.exec(arg)?.[1];
        if(id) {
            /** @type {UserConnection} */
            const cacheConnection = this.cache.get(id);
            if(cacheConnection) {
                return {
                    uuid: cacheConnection.getUUID(server),
                    username: cacheConnection.username,
                    error: null,
                };
            }

            await interaction.replyTl(keys.api.command.errors.user_not_connected);
            return { error: 'cache', uuid: null, username: null };
        }

        server = this.client.serverConnections.resolve(server);

        if(arg.match(utils.UUIDRegex)) {
            arg = utils.addHyphen(arg);
            const username = await utils.fetchUsername(arg);
            if(username && server.online) return { uuid: arg, username, error: null };
            else if(username) arg = username; // If the server is offline, we'll calculate the uuid from the username.
            else {
                await interaction.replyTl(keys.api.utils.errors.could_not_fetch_user, { user: arg });
                return { error: 'fetch', uuid: null, username: null };
            }
        }

        let uuid;
        if(server.floodgatePrefix && arg.startsWith(server.floodgatePrefix)) {
            const usernameWithoutPrefix = arg.slice(server.floodgatePrefix.length);
            uuid = await utils.fetchFloodgateUUID(usernameWithoutPrefix);
        } else uuid = server.online ? await utils.fetchUUID(arg) : utils.createUUIDv3(arg);

        if(uuid) return { uuid: uuid, username: arg, error: null };
        await interaction.replyTl(keys.api.utils.errors.could_not_fetch_user, { user: arg });
        return { error: 'fetch', uuid: null, username: null };
    }
}
