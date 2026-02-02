import Route from '../Route.js';

export default class PreDeleteCleanup extends Route {

    constructor() {
        super({
            endpoint: '/pre-delete-cleanup',
            methods: ['POST'],
            customBot: true,
        });
    }

    /**
     * Handles the cleanup of a custom bot instance before deletion.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('fastify').FastifyRequest} req - The incoming request object.
     * @param {import('fastify').FastifyReply} res - The outgoing response object.
     * @returns {Promise<RouteResponse>}
     */
    async post(client, req, res) {
        for(const server of client.serverConnections.cache.values())
            await client.serverConnections.disconnect(server);
        console.log('All server connections disconnected.');

        client.mongo.connection.db.dropDatabase();
        console.log(`${client.mongo.connection.db.databaseName} database dropped.`);
    }
}