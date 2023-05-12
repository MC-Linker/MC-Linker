import { Base } from 'discord.js';
import { getManagerStringFromConnection } from '../api/shardingUtils.js';

export default class Connection extends Base {

    /**
     * @typedef {UserConnectionData|ServerConnectionData|ServerSettingsConnectionData|UserSettingsConnectionData} ConnectionData - The data for the connection.
     */

    /**
     * @typedef {'serverConnection'|'userConnection'|'serverSettingsConnection'|'userSettingsConnection'} CollectionName - The name of a database collection.
     */
    ;

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
        const data = this.getData();
        console.log(data, this.collectionName, this.client.prisma[this.collectionName]);

        const tempId = data.id;
        delete data.id; // Prisma does not allow to update the id
        return await this.client.prisma[this.collectionName].upsert({
            where: { id: tempId },
            update: data,
            create: data,
        }).then(args => {
            console.log(args);
            return true;
        }).catch(args => {
            console.log(args);
            return false;
        });
    }

    /**
     * Deletes the data of the connection from the database.
     * @returns {Promise<boolean>} - Whether the deletion was successful.
     */
    async _delete() {
        return await this.client.prisma[this.collectionName].delete({ where: { id: this.id } })
            .then(() => true)
            .catch(() => false);
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
            await this.client.shard.broadcastEval((c, { id, data, manager, shard }) => {
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
     * Returns the writable data of the connection.
     * @returns {ConnectionData} - The writable data of the connection.
     * @abstract
     */
    getData() {
        throw new Error('Not implemented');
    }
}
