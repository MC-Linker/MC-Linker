import Route from '../Route.js';
import rootLogger from '../../utilities/logger.js';
import features from '../../utilities/logFeatures.js';

const logger = rootLogger.child({ feature: features.api.routes.preDeleteCleanup });

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
        logger.info('All server connections disconnected.');

        client.mongo.connection.db.dropDatabase();
        logger.info(`${client.mongo.connection.db.databaseName} database dropped.`);
    }
}