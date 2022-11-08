const { Base } = require('discord.js');
const fs = require('fs-extra');

class Connection extends Base {

    /**
     * @typedef {UserConnectionData|ServerConnectionData|SettingsConnectionData} ConnectionData - The data for the connection.
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
     * @returns {Promise<?UserConnection|?ServerConnection|?SettingsConnection>} - The connection instance that has been edited.
     */
    async edit(data) {
        this._patch(data);
        if(await this._output()) return this;
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

module.exports = Connection;