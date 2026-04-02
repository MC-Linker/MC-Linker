import WSEvent from '../WSEvent.js';

export default class AddSyncedRoleMember extends WSEvent {

    constructor() {
        super({
            event: 'remove-synced-role',
        });
    }

    /**
     * @typedef {Object} RemoveSyncedRoleRequest
     * @property {string} id - The ID of the synced role.
     * @property {string} uuid - The UUID of the member to remove.
     */

    /**
     * @inheritdoc
     * @param {RemoveSyncedRoleRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        const roleIndex = server.syncedRoles?.findIndex(role => role.id === data.id);
        if(roleIndex === undefined || roleIndex === -1) return;
        server.syncedRoles.splice(roleIndex, 1);
        await server.edit({});
    }
}