import { Base } from 'discord.js';
import { getManagerStringFromConnection } from '../../utilities/utils.js';
import ServerConnection from './ServerConnection.js';
import rootLogger from '../../utilities/logger/logger.js';
import features from '../../utilities/logger/features.js';
import { trackError } from '../analytics/AnalyticsCollector.js';

const logger = rootLogger.child({ feature: features.structures.connections.base });

export default class Connection extends Base {

    /**
     * @typedef {UserConnectionData|ServerConnectionData|ServerSettingsConnectionData|UserSettingsConnectionData|CustomBotConnectionData} ConnectionData - The data for the connection.
     */

    /**
     * @typedef {'ServerConnection'|'UserConnection'|'ServerSettingsConnection'|'UserSettingsConnection'|'CustomBotConnection'} CollectionName - The name of a database collection.
     */

    /**
     * @param {MCLinker} client - The client to create the connection for.
     * @param {ConnectionData} data - The data for the connection.
     * @param {CollectionName} collectionName - The name of the database collection that this connection is stored in.
     * @returns {Connection} - A new Connection instance.
     */
    constructor(client, data, collectionName) {
        super(client);

        /**
         * The name of the database collection that this connection is stored in.
         * @type {CollectionName}
         */
        this.collectionName = collectionName;
    }

    /**
     * Writes the data of the connection to the database.
     * @returns {Promise<boolean>} - Whether the data was correctly written to the database.
     */
    async _output() {
        // Clone the data to prevent modification of the original data
        const data = JSON.parse(JSON.stringify(this.getData()));

        if(this instanceof ServerConnection) {
            // map id to _id for Mongoose subdocuments
            this._remapSubdocumentIds(data.chatChannels);
            this._remapSubdocumentIds(data.statChannels);
            this._remapSubdocumentIds(data.syncedRoles);
        }

        //Remove id, otherwise duplicate key error, if object does not exist, it will use id from query (this.id)
        delete data.id;

        return await this.client.mongo.models[this.collectionName].updateOne({ _id: this.id }, data, { upsert: true })
            .then(() => true)
            .catch(err => {
                trackError('unhandled', 'Connection._output', this.id, null, err, null, logger);
                return false;
            });
    }

    /**
     * Deletes the data of the connection from the database.
     * @returns {Promise<boolean>} - Whether the deletion was successful.
     */
    async _delete() {
        return await this.client.mongo.models[this.collectionName].deleteOne({ _id: this.id })
            .then(() => true)
            .catch(err => {
                trackError('unhandled', 'Connection._delete', this.id, null, err, null, logger);
                return false;
            });
    }

    /**
     * Edits the connection with the given data and writes it to the database.
     * @param {Partial<ConnectionData>} data - The data to edit the connection with.
     * @returns {Promise<?Connection>} - The connection instance that has been edited.
     */
    async edit(data) {
        this._patch(data);
        if(await this._output()) {
            if('socket' in data) delete data.socket;// The socket is not serializable and should not be broadcasted

            // Broadcast the patch to all shards
            await this.client.broadcastEval((c, { id, data, manager, shard }) => {
                if(c.shard.ids.includes(shard)) return; // Don't patch the connection on the shard that edited it
                c[manager].cache.get(id) ? c[manager].cache.get(id)._patch(data) : c[manager].connect(data);
            }, {
                context: {
                    id: this.id,
                    data,
                    manager: getManagerStringFromConnection(this),
                    shard: this.client.shard.ids[0],
                },
            });
            return this;
        }
        else return null;
    }

    /**
     * Remaps `id` to `_id` on each element in an array of subdocuments for Mongoose storage.
     * @param {Object[]} array - The array of subdocuments to remap.
     */
    _remapSubdocumentIds(array) {
        array.forEach(item => {
            item._id = item.id;
            delete item.id;
        });
    }

    /**
     * Returns the serializable data of the connection.
     * @returns {ConnectionData} - The serializable data of the connection.
     * @abstract
     */
    getData() {
        throw new Error('Not implemented');
    }
}
