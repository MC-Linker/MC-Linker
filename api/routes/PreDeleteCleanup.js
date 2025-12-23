import Route from '../../structures/api/Route.js';

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
        for(const server of this.client.serverConnections.cache.values())
            await this.client.serverConnections.disconnect(server);
        console.log('All server connections disconnected.');

        this.client.mongo.connection.db.dropDatabase();
        console.log(`${this.client.mongo.connection.db.databaseName} database dropped.`);
    }
}