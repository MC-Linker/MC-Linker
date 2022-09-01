const ServerConnection = require('./ServerConnection');
const ConnectionManager = require('./ConnectionManager');

class ServerConnectionManager extends ConnectionManager {

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {string} outputPath - The path to write server data to.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, outputPath = './serverdata/connections') {
        super(client, ServerConnection, outputPath);
    }
}

module.exports = ServerConnectionManager;
