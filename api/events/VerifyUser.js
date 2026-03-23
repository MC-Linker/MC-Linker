import WSEvent from '../WSEvent.js';

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
     * Listens to a dm message of the user containing the code to verify the user.
     * @param {VerifyUserRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {void}
     */
    async execute(data, server, client) {
        client.api.usersAwaitingVerification.set(data.code, { uuid: data.uuid, username: data.username });
        setTimeout(() => client.api.usersAwaitingVerification.delete(data.code), 180_000);
    }
}