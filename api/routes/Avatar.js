import Route from '../Route.js';
import PlayerHeadRenderer from '../../structures/render/PlayerHeadRenderer.js';

export default class Avatar extends Route {

    constructor() {
        super({
            endpoint: '/avatar/:id',
            methods: ['GET'],
        });
    }

    /**
     * Serves a player head PNG rendered from a Mojang skin texture. `id` is the skin's texture hash
     * (optionally suffixed with `.png`) or `steve`. Urls are built by `PlayerHeadRenderer.getAvatarURL`.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('fastify').FastifyRequest} req - The incoming request object.
     * @param {import('fastify').FastifyReply} res - The outgoing response object.
     * @returns {Promise<RouteResponse|void>}
     */
    async get(client, req, res) {
        const id = String(req.params.id ?? '').toLowerCase().replace(/\.png$/, '');
        if(!PlayerHeadRenderer.isValidId(id)) return { status: 404, body: { message: 'Not found' } };

        let head = await PlayerHeadRenderer.getHead(id);
        // A texture hash is immutable, so a successful render can be cached forever. On failure serve Steve uncached.
        let cacheControl = 'public, max-age=31536000, immutable';
        if(!head && id !== PlayerHeadRenderer.STEVE_ID) {
            head = await PlayerHeadRenderer.getHead(PlayerHeadRenderer.STEVE_ID);
            cacheControl = 'no-store';
        }
        if(!head) return { status: 503, body: { message: 'Avatar unavailable' } };

        res.header('Content-Type', 'image/png').header('Cache-Control', cacheControl).send(head);
    }
}
