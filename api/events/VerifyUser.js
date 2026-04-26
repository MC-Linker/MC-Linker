import WSEvent from '../WSEvent.js';
import { fetchUUID } from '../../utilities/utils.js';

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
        const onlineUUID = server.online ? data.uuid : await fetchUUID(data.username);
        client.api.usersAwaitingVerification.set(data.code, { uuid: onlineUUID, username: data.username });
        setTimeout(() => client.api.usersAwaitingVerification.delete(data.code), 180_000);
    }
}