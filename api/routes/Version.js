import Route from '../../structures/api/Route.js';

export default class Version extends Route {

    constructor() {
        super({
            endpoint: '/version',
            methods: ['GET'],
        });
    }

    /**
     * Retrieves the latest plugin version.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('express').FastifyRequest} req - The incoming request object.
     * @param {import('express').FastifyReply} res - The outgoing response object.
     * @returns {RouteResponse}
     */
    get(client, req, res) {
        return { body: client.config.pluginVersion };
    }
}