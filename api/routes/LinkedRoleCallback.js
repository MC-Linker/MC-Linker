import Route from '../../structures/api/Route.js';
import { getTokens, getUser } from '../../utilities/oauth.js';

export default class LinkedRole extends Route {

    constructor() {
        super({
            endpoint: '/linked-role/callback',
            methods: ['GET'],
        });
    }

    /**
     * Handles the OAuth2 callback for linked roles.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('express').FastifyRequest} req - The incoming request object.
     * @param {import('express').FastifyReply} res - The outgoing response object.
     * @returns {RouteResponse}
     */
    async get(client, req, res) {
        const { code, state: discordState } = req.query;

        //Check state
        const clientState = res.unsignCookie(request.cookies.state);
        if(clientState.valid && clientState.value !== discordState) return { status: 403 };

        //Get access and refresh token
        const tokens = await getTokens(code);
        if(!tokens) return { status: 403 };

        //Get user
        const user = await getUser(this.client, tokens.accessToken);
        if(!user) return { status: 403 };

        let settings = this.client.userSettingsConnections.cache.get(user.id);
        if(settings) await settings.edit({
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expires: tokens.expires,
            },
        });
        else settings = await this.client.userSettingsConnections.connect({
            id: user.id,
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expires: tokens.expires,
            },
        });

        const userConnection = this.client.userConnections.cache.get(user.id);
        await settings.updateRoleConnection(userConnection?.username, {
            'connectedaccount': userConnection ? 1 : 0,
        });

        return `You have been authorized as ${user.tag}! You can now close this window and go back to Discord.`;
    }
}