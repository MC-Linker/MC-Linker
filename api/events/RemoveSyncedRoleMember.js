import WSEvent from '../WSEvent.js';

export default class AddSyncedRoleMember extends WSEvent {

    constructor() {
        super({
            event: 'remove-synced-role-member',
        });
    }

    /**
     * @typedef {Object} RemoveSyncedRoleMemberRequest
     * @property {string} id - The ID of the synced role.
     * @property {string} uuid - The UUID of the member to remove.
     */

    /**
     * @inheritdoc
     * @param {RemoveSyncedRoleMemberRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        await client.api.updateSyncedRoleMember(data.id, data.uuid, server, 'remove');
    }
}