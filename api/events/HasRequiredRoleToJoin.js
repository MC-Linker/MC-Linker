import WSEvent from '../WSEvent.js';
import { RESTJSONErrorCodes } from 'discord.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';
import { fetchMembersIfCacheDiffers } from '../../utilities/utils.js';

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
     * @typedef {object} HasRequiredRoleToJoinResponse
     * @property {'success'|'error'} status - The status of the response.
     * @property {{ hasRole: boolean }} [data] - The response data.
     * @property {string} [error] - The error code.
     */

    /**
     * Checks whether the minecraft-user has the required role to join the server.
     * @param {HasRequiredRoleToJoinRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {HasRequiredRoleToJoinResponse}
     */
    async execute(data, server, client) {
        if(!server.requiredRoleToJoin) return { status: 'success', data: { hasRole: true } };
        const user = client.userConnections.cache.find(u => u.getUUID(server) === data.uuid);
        if(!user) return { status: 'error', error: ProtocolError.NOT_CONNECTED };

        try {
            const guild = await client.guilds.fetch(server.id);
            const member = await guild.members.fetch(user.id);

            await fetchMembersIfCacheDiffers(client, guild);

            const hasRole = server.requiredRoleToJoin.method === 'any' && server.requiredRoleToJoin.roles.some(id => member.roles.cache.has(id)) ||
                server.requiredRoleToJoin.method === 'all' && server.requiredRoleToJoin.roles.every(id => member.roles.cache.has(id));

            return { status: 'success', data: { hasRole } };
        }
        catch(err) {
            if(err.code === RESTJSONErrorCodes.UnknownMember) return { status: 'success', data: { hasRole: false } }; // Member not in server
            else return { status: 'error', error: ProtocolError.UNKNOWN };
        }
    }
}