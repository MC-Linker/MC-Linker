import Route from '../../structures/api/Route.js';
import { getOAuthURL } from '../../utilities/oauth.js';

export default class LinkedRole extends Route {

    constructor() {
        super({
            endpoint: '/linked-role',
            methods: ['GET'],
        });
    }

    /**
     * Initiates the OAuth2 flow for linked roles.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('express').FastifyRequest} req - The incoming request object.
     * @param {import('express').FastifyReply} res - The outgoing response object.
     * @returns {RouteResponse}
     */
    get(client, req, res) {
        // Generate state
        const { state, url } = getOAuthURL();
        res.setCookie('state', state, { maxAge: 1000 * 60 * 5, signed: true });
        res.redirect(url);
    }
}