import CustomBotConnection from './CustomBotConnection.js';
import ConnectionManager from './ConnectionManager.js';

export default class CustomBotConnectionManager extends ConnectionManager {

    /**
     * The port to start searching for available ports from.
     * @type {number}
     */
    static STARTING_PORT = 30_000;

    /**
     * @type {import('discord.js').Collection<string, CustomBotConnection>}
     */
    cache;

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, collectionName = 'CustomBotConnection') {
        super(client, CustomBotConnection, collectionName);

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, ServerConnection>}
         */
        this.cache = super.cache;
    }

    /**
     * Gets the port range for custom bots.
     * @return {number[]}
     */
    getPortRange() {
        const startPort = CustomBotConnectionManager.STARTING_PORT;
        const endPort = this.cache.reduce((max, connection) => Math.max(max, connection.port), startPort);
        return [startPort, endPort];
    }

    /**
     * Finds the next available port for a new custom bot connection.
     * @return {number} - The next available port.
     */
    getNewAvailablePort() {
        const usedPorts = this.cache.map(connection => connection.port);
        let port = CustomBotConnectionManager.STARTING_PORT;
        while(usedPorts.includes(port)) port++;
        return port;
    }
}