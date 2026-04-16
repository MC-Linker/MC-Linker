import WSEvent from '../WSEvent.js';

export default class RemoveSyncedRole extends WSEvent {

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
        if(!server.syncedRoles) return;
        const filtered = server.syncedRoles.filter(role => role.id !== data.id);
        if(filtered.length === server.syncedRoles.length) return;
        await server.edit({ syncedRoles: filtered });
    }
}