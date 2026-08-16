import { createUUIDv3, isFloodgateUUID } from '../../utilities/utils.js';
import Connection from './Connection.js';
import fs from 'fs-extra';
import ServerFiles from '../protocol/ServerFiles.js';

export default class UserConnection extends Connection {

    /**
     * @typedef {object} UserConnectionData - The data for a user connection.
     * @property {string} [id] - Composite id `${discordId}:${scope}`. Auto-derived from `discordId`+`scope` if absent.
     * @property {string} discordId - The Discord user id this link belongs to.
     * @property {'global'|string} scope - The scope of the link: 'global' or a server (guild) id.
     * @property {string} uuid - The minecraft uuid of the user (Mojang/Floodgate when premium, offline-v3 when not).
     * @property {string} username - The minecraft username of the user.
     * @property {boolean} premium - Whether this link is backed by a globally-unique authoritative UUID (Mojang or Floodgate/Bedrock).
     */

    /**
     * @typedef {UserConnection|string} UserConnectionResolvable - Data that resolves to a UserConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the user connection for.
     * @param {UserConnectionData} data - The data for the user connection.
     * @param {CollectionName} collectionName - The name of the database collection that this connection is stored in.
     * @returns {UserConnection} - A new UserConnection instance.
     */
    constructor(client, data, collectionName = 'UserConnection') {
        super(client, data, collectionName);

        this._patch(data);
    }

    /**
     * Builds the composite cache/_id key for a Discord user + scope pair.
     * @param {string} discordId
     * @param {string} scope
     * @returns {string}
     */
    static buildId(discordId, scope) {
        return `${discordId}:${scope}`;
    }

    /**
     * Gets the uuid of this link as it applies to the given server. Returns null when the link is not valid for the
     * requested server scope (per-server link queried about a different server, no server context, or cracked link
     * on an online-mode server).
     *
     * Adapts to the server's *current* online mode for both global and per-server links — never blindly returns the
     * stored uuid. This means online-mode flips on the server side don't require deleting per-server premium pins:
     * the same link transparently produces the v3 hash on offline servers and the Mojang UUID on online ones.
     * @param {ServerConnectionResolvable} server - The server to resolve the UUID for.
     * @returns {?string}
     */
    getUUID(server) {
        const serverData = this.client.serverConnections.resolve(server);
        if(!serverData) return null;
        if(this.scope !== 'global' && this.scope !== serverData.id) return null;

        // Floodgate (Bedrock) UUIDs work on any server mode — Geyser/Floodgate authenticates Bedrock players itself.
        if(isFloodgateUUID(this.uuid)) return this.uuid;

        if(serverData.online) {
            // Online-mode Java server: only Mojang-authenticated UUIDs are valid; cracked links are dead here.
            return this.premium ? this.uuid : null;
        }
        // Offline-mode Java server: server keys playerdata by createUUIDv3(username) regardless of who the player is.
        return createUUIDv3(this.username);
    }

    _patch(data) {
        /**
         * The Discord user id this link belongs to.
         * @type {string}
         */
        this.discordId = data.discordId ?? this.discordId;

        /**
         * The scope of the link: 'global' or a server (guild) id.
         * @type {string}
         */
        this.scope = data.scope ?? this.scope ?? 'global';

        /**
         * The composite id used as the cache key and Mongo _id.
         * @type {string}
         */
        this.id = data.id ?? UserConnection.buildId(this.discordId, this.scope);

        /**
         * The minecraft uuid of this user. Always use getUUID(server) for the server-effective UUID.
         * @type {string}
         */
        this.uuid = data.uuid ?? this.uuid;

        /**
         * The minecraft username of this user.
         * @type {string}
         */
        this.username = data.username ?? this.username;

        /**
         * Whether this link is backed by a globally-unique authoritative UUID (Mojang or Floodgate/Bedrock).
         * @type {boolean}
         */
        this.premium = data.premium ?? this.premium ?? false;
    }

    /**
     * Removes the cached player files of this user connection.
     * The files are cached per server, so a global link removes them from every server, while a
     * per-server link only removes them from the server it is scoped to.
     * @returns {Promise<boolean>}
     */
    async removeCache() {
        try {
            const serverIds = this.scope === 'global'
                ? await fs.readdir(`${ServerFiles.CACHE_ROOT}/serverConnection`).catch(() => [])
                : [this.scope];

            await Promise.all(serverIds
                .flatMap(serverId => ServerFiles.playerCachePaths(serverId, this.uuid))
                .map(path => fs.rm(path, { force: true })));
            return true;
        }
        catch {
            return false;
        }
    }

    getData() {
        return {
            id: this.id,
            discordId: this.discordId,
            scope: this.scope,
            uuid: this.uuid,
            username: this.username,
            premium: this.premium,
        };
    }
}
