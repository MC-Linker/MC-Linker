import Route from '../Route.js';
import MCLinker from '../../structures/MCLinker.js';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.api.routes.presence });

export default class Presence extends Route {

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
            client.analytics.trackError('api_rest', 'Presence', null, null, err, null, logger);
            return { status: 500, body: err };
        }

        return { status: 200 };
    }
}