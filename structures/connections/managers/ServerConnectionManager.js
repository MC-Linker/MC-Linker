import ServerConnection from '../ServerConnection.js';
import ConnectionManager from './ConnectionManager.js';
import { ShardClientUtil } from 'discord.js';
import rootLogger from '../../../utilities/logger/Logger.js';
import features from '../../../utilities/logger/features.js';
import { trackError } from '../../analytics/AnalyticsCollector.js';

const logger = rootLogger.child({ feature: features.structures.connections.server });

export default class ServerConnectionManager extends ConnectionManager {

    /**
     * @type {import('discord.js').Collection<string, ServerConnection>}
     */
    cache;

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, collectionName = 'ServerConnection') {
        super(client, ServerConnection, collectionName);

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, ServerConnection>}
         */
        this.cache = super.cache;
    }

    async disconnect(connectionResolvable) {
        /** @type {ServerConnection} */
        const connection = this.resolve(connectionResolvable);
        if(!connection) return false;

        for(const channel of connection?.chatChannels ?? []) {
            for(const webhookId of channel.webhooks ?? []) {
                try {
                    const webhook = await this.client.fetchWebhook(webhookId);
                    await webhook.delete();
                }
                catch(err) {
                    trackError('unhandled', 'ServerConnectionManager.disconnect', connection.id, null, err, { webhookId }, logger);
                }
            }
        }
        await connection.protocol.disconnect();

        if(!await super.disconnect(connection)) return false;
        await connection.removeCache();
        return true;
    }

    /**
     * Kicks a player from all connected Minecraft servers that require a linked account to join,
     * restricted to servers where the given Discord user is an actual guild member.
     * Silently ignores servers that are offline or fail to respond.
     * @param {string} userId - The Discord user ID of the player.
     * @param {string} username - The Minecraft username to kick.
     * @param {string} message - The kick message.
     * @returns {Promise<void>}
     */
    async kickFromRequiredRoleServers(userId, username, message) {
        const shardMap = this._groupByShardId(conn => !!conn.requiredRoleToJoin);

        await Promise.all(
            [...shardMap.entries()].map(([shardId, serverIds]) =>
                this.client.broadcastEval(async (c, { serverIds, userId, username, message }) => {
                    await Promise.allSettled(serverIds.map(async serverId => {
                        const server = c.serverConnections.cache.get(serverId);
                        if(!server) return;

                        const guild = c.guilds.cache.get(serverId);
                        await guild.members.fetch(userId); // Will throw if user is not part of guild
                        return server.protocol.execute(`kick ${username} ${message}`);
                    }));
                }, { context: { serverIds, userId, username, message }, shard: shardId }),
            ),
        );
    }

    /**
     * Syncs synced roles for a user across all server connections that have synced roles configured.
     * Groups connections by shard to minimize IPC overhead.
     * Silently skips servers where the member cannot be fetched or the shard eval fails.
     * @param {string} userId - The Discord user ID.
     * @returns {Promise<void>}
     */
    async syncRolesAcrossAllServers(userId) {
        const shardMap = this._groupByShardId(conn => !!conn.syncedRoles?.length);

        await Promise.all(
            [...shardMap.entries()].map(([shardId, serverIds]) =>
                this.client.broadcastEval(async (c, { serverIds, userId }) => {
                    const userConn = c.userConnections.cache.get(userId);
                    if(!userConn) return;

                    await Promise.allSettled(serverIds.map(async serverId => {
                        const server = c.serverConnections.cache.get(serverId);
                        if(!server) return;

                        const guild = await c.guilds.fetch(serverId);
                        const member = await guild.members.fetch(userId); // Will throw if user is not part of server
                        await server.syncRolesOfMember(member, userConn);
                    }));
                }, { context: { serverIds, userId }, shard: shardId }),
            ),
        );
    }

    /**
     * Groups cached server connection IDs by their owning shard, filtered by a predicate.
     * @param {(conn: ServerConnection) => boolean} predicate - Filter applied to each connection.
     * @returns {Map<number, string[]>} - Map of shardId → array of matching guild IDs.
     */
    _groupByShardId(predicate) {
        const shardMap = new Map();
        for(const conn of this.cache.values()) {
            if(!predicate(conn)) continue;
            const shardId = ShardClientUtil.shardIdForGuildId(conn.id, this.client.shard.count);
            if(!shardMap.has(shardId)) shardMap.set(shardId, []);
            shardMap.get(shardId).push(conn.id);
        }
        return shardMap;
    }

    async _load() {
        await super._load();

        //If settings connections are loaded, load the settings for each server.
        if(!this.client.serverSettingsConnections.cache.size) return;

        for(const connection of this.cache.values()) {
            const settings = this.client.serverSettingsConnections.cache.get(connection.id);
            if(settings) connection.settings = settings;
        }
    }
}
