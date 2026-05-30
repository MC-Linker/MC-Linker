import WSEvent from '../WSEvent.js';
import { createUUIDv3, fetchUUID } from '../../utilities/uuid-utils.js';

export default class VerifyUser extends WSEvent {

    constructor() {
        super({
            event: 'verify-user',
            dispatchToGuildShard: false,
        });
    }

    /**
     * @typedef {Object} VerifyUserRequest
     * @property {string} code - The verification code.
     * @property {string} uuid - The UUID of the user.
     * @property {string} username - The username of the user.
     */

    /**
     * @inheritdoc
     * @param {VerifyUserRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        // On online-mode servers, the plugin already provides the authoritative Mojang UUID.
        // On offline-mode servers, attempt a Mojang lookup by username; fall back to offline-v3 for cracked players.
        const mojangUUID = server.online ? data.uuid : await fetchUUID(data.username);
        const premium = !!mojangUUID;
        const uuid = mojangUUID ?? createUUIDv3(data.username);

        client.api.usersAwaitingVerification.set(data.code, {
            uuid,
            username: data.username,
            premium,
            serverId: server.id,
        });
        setTimeout(() => client.api.usersAwaitingVerification.delete(data.code), 180_000);
    }
}
