import WSEvent from '../../structures/api/WSEvent.js';

export default class DisconnectForce extends WSEvent {

    constructor() {
        super({
            event: 'disconnect-force',
        });
    }

    /**
     * Forcefully disconnects the server connection.
     * @param {{}} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {void}
     */
    execute(data, server, client) {
        client.serverConnections.disconnect(server);
    }
}