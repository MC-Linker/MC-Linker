const { createUUIDv3 } = require('../../api/utils');
const Connection = require('./Connection');

class UserConnection extends Connection {
    /**
     * @typedef {object} UserConnectionData - The data for a user connection.
     * @property {string} id - The id of the user.
     * @property {string} uuid - The minecraft uuid of the user.
     * @property {string} username - The minecraft username of the user.
     */

    /**
     * @typedef {UserConnection|string} UserConnectionResolvable - Data that resolves to a UserConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the user connection for.
     * @param {UserConnectionData} data - The data for the user connection.
     * @param {string} outputPath - The path to write the user connection to.
     * @returns {UserConnection} - A new UserConnection instance.
     */
    constructor(client, data, outputPath) {
        super(client, data, outputPath);
        this._patch(data);
    }

    /**
     * Gets the uuid of this user respecting whether the server is online mode.
     * @param {string|ServerConnection} server - The server to get the online mode property from.
     * @returns {string} - The uuid of the user.
     */
    getUUID(server) {
        const serverData = this.client.serverConnections.resolve(server);
        if(serverData?.online === undefined || serverData.online) return this.uuid;
        else return createUUIDv3(this.username);
    }

    _patch(data) {
        /**
         * The id of this user.
         * @type {string}
         */
        this.id = data.id ?? this.id;
        /**
         * The minecraft uuid of this user.
         * @type {string}
         */
        this.uuid = data.uuid ?? this.uuid;
        /**
         * The minecraft username of this user.
         * @type {string}
         */
        this.username = data.username ?? this.username;
    }

    /**
     * @inheritDoc
     */
    getData() {
        return {
            id: this.id,
            uuid: this.uuid,
            username: this.username,
        };
    }
}

module.exports = UserConnection;
