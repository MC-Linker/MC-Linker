import Route from '../Route.js';

export default class CustomBotApiReady extends Route {

    constructor() {
        super({
            endpoint: '/custom-bot-api-ready',
            methods: ['POST'],
        });
    }

    /**
     * Acknowledge the custom bot is ready (sends 200). Is listened to additionally in CustomBotConnectionManager
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('fastify').FastifyRequest} req - The incoming request object.
     * @param {import('fastify').FastifyReply} res - The outgoing response object.
     * @returns {Promise<RouteResponse>}
     */
    async post(client, req, res) {
    }
}