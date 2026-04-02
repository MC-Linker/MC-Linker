import WSEvent from '../WSEvent.js';

export default class DisconnectForce extends WSEvent {

    constructor() {
        super({
            event: 'disconnect-force',
        });
    }

    /**
     * @inheritdoc
     * @param {{}} data - No request data.
     * @param server
     * @param client
     * @param logger
     */
    run(data, server, client, logger) {
        void client.serverConnections.disconnect(server);
    }
}