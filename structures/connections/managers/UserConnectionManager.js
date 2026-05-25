import UserConnection from '../UserConnection.js';
import ConnectionManager from './ConnectionManager.js';
import * as utils from '../../../utilities/utils.js';
import Discord from 'discord.js';
import keys from '../../../utilities/keys.js';

export default class UserConnectionManager extends ConnectionManager {

    /**
     * @type {import('discord.js').Collection<string, UserConnection>}
     */
    cache;

    /**
     * Creates a new UserConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {UserConnectionManager} - A new UserConnectionManager instance.
     */
    constructor(client, collectionName = 'UserConnection') {
        super(client, UserConnection, collectionName);

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, UserConnection>}
         */
        this.cache = super.cache;
    }

    /**
     * @typedef {object} UserResponse
     * @property {?string} uuid - The uuid of the user.
     * @property {?string} username - The username of the user.
     * @property {?'nullish'|?'fetch'|?'cache'} error - The error that occurred.
     */

    /**
     * Connect a new user link. Accepts either a pre-built composite `id` or `discordId`+`scope`
     * which are normalised to the composite id automatically.
     * @param {UserConnectionData} data
     * @returns {Promise<?UserConnection>}
     */
    async connect(data) {
        const normalized = { ...data };
        if(!normalized.scope) normalized.scope = 'global';

        if(!normalized.discordId && normalized.id && !normalized.id.includes(':')) {
            // Defensive backwards-compat: legacy callers passed `id: discordId`.
            normalized.discordId = normalized.id;
            delete normalized.id;
        }

        if(!normalized.id) normalized.id = UserConnection.buildId(normalized.discordId, normalized.scope);
        return super.connect(normalized);
    }

    /**
     * Returns the user's global link if one exists.
     * @param {string} discordId
     * @returns {?UserConnection}
     */
    getGlobal(discordId) {
        return this.cache.get(UserConnection.buildId(discordId, 'global')) ?? null;
    }

    /**
     * Returns the user's effective link for a given server: per-server link takes priority,
     * with fallback to the global link. This is what every server-scoped feature should use.
     * @param {string} discordId
     * @param {ServerConnectionResolvable} server
     * @returns {?UserConnection}
     */
    resolveForServer(discordId, server) {
        const serverData = this.client.serverConnections.resolve(server);
        if(serverData) {
            const perServer = this.cache.get(UserConnection.buildId(discordId, serverData.id));
            if(perServer) return perServer;
        }
        return this.cache.get(UserConnection.buildId(discordId, 'global')) ?? null;
    }

    /**
     * Returns all links for a Discord user (global + every per-server).
     * @param {string} discordId
     * @returns {UserConnection[]}
     */
    getAll(discordId) {
        return this.cache.values().filter(c => c.discordId === discordId).toArray();
    }

    /**
     * Raw lookup by (discordId, scope). Features should call {@link resolveForServer} or {@link getGlobal}.
     * @param {string} discordId
     * @param {string} scope
     * @returns {?UserConnection}
     */
    getRaw(discordId, scope) {
        return this.cache.get(UserConnection.buildId(discordId, scope)) ?? null;
    }

    /**
     * Returns the uuid and name of a minecraft user from a mention/username.
     * @param {string} arg - The argument to get the uuid and name from.
     * @param {ServerConnectionResolvable} server - The server to resolve the uuid and name from.
     * @param {TranslatedResponses} interaction - The interaction to reply to if the user is not connected.
     * @returns {Promise<UserResponse>} - The uuid and name of the user.
     */
    async userFromArgument(arg, server, interaction) {
        if(!arg) {
            await interaction.editReplyTl(keys.api.command.warnings.no_user);
            return { error: 'nullish', uuid: null, username: null };
        }

        const id = Discord.MessageMentions.UsersPattern.exec(arg)?.[1];
        if(id) {
            const cacheConnection = this.resolveForServer(id, server);
            if(cacheConnection) {
                return {
                    uuid: cacheConnection.getUUID(server),
                    username: cacheConnection.username,
                    error: null,
                };
            }

            await interaction.editReplyTl(keys.api.command.errors.user_not_connected);
            return { error: 'cache', uuid: null, username: null };
        }

        server = this.client.serverConnections.resolve(server);

        if(arg.match(utils.UUIDRegex)) {
            arg = utils.addHyphen(arg);
            const username = await utils.fetchUsername(arg);
            if(username && server.online) return { uuid: arg, username, error: null };
            else if(username) arg = username; // Offline server: derive uuid from username below
            else {
                await interaction.editReplyTl(keys.api.utils.errors.could_not_fetch_user, { user: arg });
                return { error: 'fetch', uuid: null, username: null };
            }
        }

        let uuid;
        if(!server.online) uuid = utils.createUUIDv3(arg);
        else if(server.floodgatePrefix && arg.startsWith(server.floodgatePrefix)) {
            const usernameWithoutPrefix = arg.slice(server.floodgatePrefix.length);
            uuid = await utils.fetchFloodgateUUID(usernameWithoutPrefix);
        }
        else uuid = await utils.fetchUUID(arg);

        if(uuid) return { uuid, username: arg, error: null };
        await interaction.editReplyTl(keys.api.utils.errors.could_not_fetch_user, { user: arg });
        return { error: 'fetch', uuid: null, username: null };
    }

    /**
     * Finds a UserConnection by Minecraft UUID for a given server.
     * Prefers a per-server link with that exact UUID; falls back to scanning global links via getUUID.
     * Accepts UUIDs with or without hyphens.
     * @param {string} uuid - The Minecraft UUID to search for.
     * @param {ServerConnectionResolvable} server
     * @returns {?UserConnection}
     */
    findByUUID(uuid, server) {
        const target = utils.addHyphen(uuid);
        const serverData = this.client.serverConnections.resolve(server);
        if(serverData) {
            const perServer = this.cache.find(c => c.scope === serverData.id && c.uuid === target);
            if(perServer) return perServer;
        }
        return this.cache.find(c => c.scope === 'global' && c.getUUID(server) === target) ?? null;
    }

    /**
     * Finds a UserConnection by Minecraft username scoped to a server. Per-server links match first;
     * global links fall back. This avoids cross-server collisions on cracked usernames.
     * @param {string} username
     * @param {ServerConnectionResolvable} server
     * @returns {?UserConnection}
     */
    findByUsername(username, server) {
        const lower = username.toLowerCase();
        const serverData = this.client.serverConnections.resolve(server);
        if(serverData) {
            const perServer = this.cache.find(c => c.scope === serverData.id && c.username.toLowerCase() === lower);
            if(perServer) return perServer;
        }
        return this.cache.find(c => c.scope === 'global' && c.username.toLowerCase() === lower) ?? null;
    }

    async disconnect(connectionResolvable) {
        const connection = this.resolve(connectionResolvable);
        if(!connection) return false;

        if(!await super.disconnect(connection)) return false;
        await connection.removeCache();
        return true;
    }
}
