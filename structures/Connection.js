import { Base } from 'discord.js';
import fs from 'fs-extra';
import { getManagerStringFromConnection } from '../api/shardingUtils.js';

export default class Connection extends Base {

    /**
     * @typedef {UserConnectionData|ServerConnectionData|ServerSettingsConnectionData|UserSettingsConnectionData} ConnectionData - The data for the connection.
     */

    /**
     * @param {MCLinker} client - The client to create the connection for.
     * @param {ConnectionData} data - The data for the connection.
     * @param {string} outputPath - The path to write the connection to.
     * @param {string} outputFile - The name of the file to write the connection data to.
     * @returns {Connection} - A new Connection instance.
     */
    constructor(client, data, outputPath, outputFile) {
        super(client);

        /**
         * The path to write this connection to.
         * @type {string}
         */
        this.outputPath = `${outputPath}/${data.id}`;

        /**
         * The file name of the connection.
         * @type {string}
         */
        this.outputFile = outputFile;
    }

    /**
     * Writes the data of the connection to the fs.
     * @returns {Promise<boolean>} - Whether the data was correctly written to the fs.
     */
    async _output() {
        const data = this.getData();
        return await fs.outputJson(`${this.outputPath}/${this.outputFile}`, data, { spaces: 2 })
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Deletes the data of the connection from the fs.
     * @returns {Promise<boolean>} - Whether the deletion was successful.
     */
    async _delete() {
        return await fs.rm(`${this.outputPath}/${this.outputFile}`)
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Edits the connection with the given data and writes it to the fs.
     * @param {Partial<ConnectionData>} data - The data to edit the connection with.
     * @returns {Promise<?UserConnection|?ServerConnection|?ServerSettingsConnection|?UserSettingsConnection>} - The connection instance that has been edited.
     */
    async edit(data) {
        this._patch(data);
        if(await this._output()) {
            // Broadcast the patch to all shards
            await this.client.shard.broadcastEval((c, { id, data, manager }) => {
                c[manager].cache.get(id) ? c[manager].cache.get(id)._patch(data) : c[manager].connect(data);
            }, { context: { id: this.id, data, manager: getManagerStringFromConnection(this) } });
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
