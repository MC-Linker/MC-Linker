import WSEvent from '../WSEvent.js';
import { RESTJSONErrorCodes } from 'discord.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';

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
     * @inheritdoc
     * @param {HasRequiredRoleToJoinRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        if(!server.requiredRoleToJoin) return { status: 'success', data: { hasRole: true } };
        const user = client.userConnections.findByUUID(data.uuid, server);
        if(!user) return { status: 'error', error: ProtocolError.NOT_CONNECTED };

        try {
            const guild = await client.guilds.fetch(server.id);
            const member = await guild.members.fetch(user.id);

            return { status: 'success', data: { hasRole: server.hasRequiredRole(member) } };
        }
        catch(err) {
            if(err.code === RESTJSONErrorCodes.UnknownMember) return { status: 'success', data: { hasRole: false } }; // Member not in server
            else return { status: 'error', error: ProtocolError.UNKNOWN };
        }
    }
}