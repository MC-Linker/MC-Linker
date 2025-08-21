import { CachedManager } from 'discord.js';
import { getManagerString } from '../utilities/shardingUtils.js';

export default class ConnectionManager extends CachedManager {

    /**
     * @typedef {ServerConnectionData|UserConnectionData|ServerSettingsConnectionData|UserSettingsConnectionData} ConnectionData - The data for any connection.
     */

    /**
     * @typedef {ServerConnectionResolvable|UserConnectionResolvable|ServerSettingsConnectionResolvable|UserSettingsConnectionResolvable|CustomBotConnectionResolvable} ConnectionResolvable - The resolvable for any connection.
     */

    /**
     * The server connection cache of this manager.
     * @type {import('discord.js').Collection<string, import('./Connection.js').default>}
     */
    cache;

    /**
     * Creates a new ConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {typeof import('./Connection.js').default} holds - The type of connection the manager holds.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {ConnectionManager} - A new ConnectionManager instance.
     */
    constructor(client, holds, collectionName) {
        super(client, holds);

        /**
         * The name of the database collection that this manager controls.
         * @type {CollectionName}
         */
        this.collectionName = collectionName;

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, import('./Connection.js').default>}
         */
        this.cache = super.cache;
    }

    /**
     * Adds a connection to the cache and writes the data to the file system.
     * @param {ConnectionData} data - The data for the connection.
     * @returns {Promise<?import('./Connection.js').default>} - The connection instance that has been created.
     */
    async connect(data) {
        /** @type {?Connection} */
        const connection = this._add(data, true, { extras: [this.collectionName] });
        if(connection && await connection._output()) {
            if('socket' in data) delete data.socket;// The socket is not serializable and should not be broadcasted
            //Broadcast to all shards
            await this.client.shard.broadcastEval((c, { data, manager, shard }) => {
                if(c.shard.ids.includes(shard)) return; // Don't patch the connection on the shard that edited it
                c[manager]._add(data, true, { extras: [c[manager].collectionName] });
            }, { context: { data, manager: getManagerString(this), shard: this.client.shard.ids[0] } });
            return connection;
        }
        else {
            this.cache.delete(this.resolveId(connection));
            return null;
        }
    }

    /**
     * Removes a connection from the cache and deletes the data from the database.
     * @param {Connection} connection - The connection to disconnect.
     * @returns {Promise<boolean>} - Whether the disconnection was successful.
     */
    async disconnect(connection) {
        if(connection && await connection._delete()) {
            //Broadcast to all shards
            await this.client.shard.broadcastEval((c, { connectionId, manager, shard }) => {
                if(c.shard.ids.includes(shard)) return; // Don't patch the connection on the shard that edited it
                c[manager].cache.delete(connectionId);
            }, {
                context: {
                    connectionId: connection.id,
                    manager: getManagerString(this),
                    shard: this.client.shard.ids[0],
                },
            });
            return this.cache.delete(this.resolveId(connection));
        }
        else return false;
    }

    /**
     * Loads all connections from the database.
     * @returns {Promise<void>}
     */
    async _load() {
        const connections = await this.client.mongo.models[this.collectionName].find({});
        for(const mongoConnection of connections) {
            // Clone the connection so we can map _id to id without violating the schema
            const connection = JSON.parse(JSON.stringify(mongoConnection));

            //map _id to id
            connection.id = connection._id;
            delete connection._id;

            if('chatChannels' in connection) {
                //map chatChannels _id to id
                connection.chatChannels = connection.chatChannels.map(channel => {
                    channel.id = channel._id;
                    delete channel._id;
                    return channel;
                });
            }
            if('statChannels' in connection) {
                //map statChannels _id to id
                connection.statChannels = connection.statChannels.map(channel => {
                    channel.id = channel._id;
                    delete channel._id;
                    return channel;
                });
            }
            if('syncedRoles' in connection) {
                //map syncedRoles _id to id
                connection.syncedRoles = connection.syncedRoles.map(role => {
                    role.id = role._id;
                    delete role._id;
                    return role;
                });
            }

            await this._add(connection, true, { extras: [this.collectionName] });
        }
    }
}
