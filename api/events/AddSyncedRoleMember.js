import WSEvent from '../WSEvent.js';

export default class AddSyncedRoleMember extends WSEvent {

    constructor() {
        super({
            event: 'add-synced-role-member',
        });
    }

    /**
     * @typedef {Object} AddSyncedRoleMemberRequest
     * @property {string} id - The ID of the synced role.
     * @property {string} uuid - The UUID of the member to add.
     */

    /**
     * @inheritdoc
     * @param {AddSyncedRoleMemberRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        await client.api.updateSyncedRoleMember(data.id, data.uuid, server, 'add');
    }
}