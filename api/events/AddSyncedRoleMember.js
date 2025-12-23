import WSEvent from '../../structures/api/WSEvent.js';

export default class AddSyncedRoleMember extends WSEvent {

    /**
     * @typedef {Object} AddSyncedRoleMemberRequest
     * @property {string} id - The ID of the synced role.
     * @property {string} uuid - The UUID of the member to add.
     */

    constructor() {
        super({
            event: 'add-synced-role-member',
        });
    }

    /**
     * Adds a member to the synced role in the discord server.
     * @param {AddSyncedRoleMemberRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async execute(data, server, client) {
        await client.api.updateSyncedRoleMember(data.id, data.uuid, server, 'add');
    }
}