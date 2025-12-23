import WSEvent from '../../structures/api/WSEvent.js';

export default class AddSyncedRoleMember extends WSEvent {

    /**
     * @typedef {Object} RemoveSyncedRoleMemberRequest
     * @property {string} id - The ID of the synced role.
     * @property {string} uuid - The UUID of the member to remove.
     */

    constructor() {
        super({
            event: 'remove-synced-role-member',
        });
    }

    /**
     * Removes a member from the synced role in the discord server.
     * @param {RemoveSyncedRoleMemberRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async execute(data, server, client) {
        await client.api.updateSyncedRoleMember(data.id, data.uuid, server, 'remove');
    }
}