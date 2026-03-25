import Route from '../Route.js';
import MCLinker from '../../structures/MCLinker.js';
import rootLogger from '../../utilities/logger.js';
import features from '../../utilities/logFeatures.js';

const logger = rootLogger.child({ feature: features.api.routes.presence });

export default class Version extends Route {

    constructor() {
        super({
            endpoint: '/presence',
            methods: ['POST'],
            customBot: true,
        });
    }

    /**
     * Changes the custom bot's custom presence.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('fastify').FastifyRequest} req - The incoming request object.
     * @param {import('fastify').FastifyReply} res - The outgoing response object.
     * @returns {Promise<RouteResponse>}
     */
    async post(client, req, res) {
        const data = await req.body;
        try {
            await client.user.setPresence(data);
            client.config.presence = data;
            await MCLinker.writeConfig(client.config);
        }
        catch(err) {
            logger.error(err, 'Error while setting custom bot presence');
            return { status: 500, body: err };
        }
    }
}