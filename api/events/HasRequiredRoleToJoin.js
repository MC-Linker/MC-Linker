import WSEvent from '../../structures/api/WSEvent.js';

export default class HasRequiredRoleToJoin extends WSEvent {

    constructor() {
        super({
            event: 'has-required-role',
        });
    }

    /**
     * @typedef {Object} HasRequiredRoleToJoinRequest
     * @property {string} uuid - The UUID of the user to check.
     */

    /**
     * @typedef {'not_connected'|'error'|boolean} HasRequiredRoleToJoinResponse - Whether the user has the required role to join, 'not_connected' if the user is not connected to the Discord bot, or 'error' if an error occurred.
     */

    /**
     * Checks whether the minecraft-user has the required role to join the server.
     * @param {HasRequiredRoleToJoinRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {HasRequiredRoleToJoinResponse}
     */
    async execute(data, server, client) {
        if(!server.requiredRoleToJoin) return true;
        const user = this.client.userConnections.cache.find(u => u.uuid === data.uuid);
        if(!user) return 'not_connected';

        try {
            const guild = await this.client.guilds.fetch(server.id);
            const member = await guild.members.fetch({ user: user.id, force: true });

            return server.requiredRoleToJoin.method === 'any' && server.requiredRoleToJoin.roles.some(id => member.roles.cache.has(id)) ||
                server.requiredRoleToJoin.method === 'all' && server.requiredRoleToJoin.roles.every(id => member.roles.cache.has(id));
        }
        catch(err) {
            if(err.code === RESTJSONErrorCodes.UnknownMember) return false; // Member not in server
            else return 'error';
        }
    }
}