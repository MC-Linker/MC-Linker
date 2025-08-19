import Connection from './Connection.js';

export default class CustomBotConnection extends Connection {
    /**
     * @typedef {Object} CustomBotConnectionData
     * @property {string} id - The ID of the custom bot.\
     * @property {number} port - The port the custom bot is listening on.
     * @property {string} ownerId - The ID of the owner of the custom bot.
     */

    /**
     * Creates a new CustomBot instance.
     * @param {MCLinker} client - The client to create the custom bot for.
     * @param {CustomBotConnectionData} data - The data for this custom bot.
     */
    constructor(client, data) {
        super(client, data, 'CustomBotConnection');

        /**
         * The ID of the custom bot.
         * @type {string}
         */
        this.id = data.id;

        /**
         * The port the custom bot is listening on.
         * @type {number}
         */
        this.port = data.port;

        /**
         * The ID of the owner of the custom bot.
         * @type {string}
         */
        this.ownerId = data.ownerId;
    }

    getData() {
        return {
            id: this.id,
            port: this.port,
            ownerId: this.ownerId,
        };
    }
}