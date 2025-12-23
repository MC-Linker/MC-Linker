import WSEvent from '../../structures/api/WSEvent.js';

export default class AddSyncedRoleMember extends WSEvent {

    /**
     * @typedef {Object} RemoveSyncedRoleRequest
     * @property {string} id - The ID of the synced role.
     * @property {string} uuid - The UUID of the member to remove.
     */

    constructor() {
        super({
            event: 'remove-synced-role',
        });
    }

    /**
     * Removes a synced role from the discord server.
     * @param {RemoveSyncedRoleRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async execute(data, server, client) {
        const roleIndex = server.syncedRoles?.findIndex(role => role.id === data.id);
        if(roleIndex === undefined || roleIndex === -1) return;
        server.syncedRoles.splice(roleIndex, 1);
        await server.edit({});
    }
}