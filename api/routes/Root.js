import Route from '../Route.js';

export default class Root extends Route {

    constructor() {
        super({
            endpoint: '/',
            methods: ['GET'],
        });
    }

    /**
     * Redirects to the MCLinker website.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('express').FastifyRequest} req - The incoming request object.
     * @param {import('express').FastifyReply} res - The outgoing response object.
     * @returns {RouteResponse}
     */
    get(client, req, res) {
        res.redirect('https://mclinker.com');
    }
}