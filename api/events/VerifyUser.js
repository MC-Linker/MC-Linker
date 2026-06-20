import WSEvent from '../WSEvent.js';
import { addHyphen, createUUIDv3, fetchUUID, isFloodgateUUID } from '../../utilities/uuid-utils.js';

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
        // Normalise to the hyphenated form the rest of the bot stores/compares with.
        const pluginUUID = data.uuid ? addHyphen(data.uuid) : null;
        let uuid, premium;

        if(isFloodgateUUID(pluginUUID)) {
            // Bedrock player via Floodgate: the XUID-based UUID the plugin provided is authoritative on any mode
            // (Floodgate handles Bedrock auth itself, independent of the Java server's online-mode flag).
            uuid = pluginUUID;
            premium = true;
        }
        else if(server.online) {
            // Online Java server: plugin's UUID is the Mojang UUID.
            uuid = pluginUUID;
            premium = true;
        }
        else {
            // Offline Java server: attempt a Mojang lookup by username; fall back to offline-v3 for cracked players.
            const mojangUUID = await fetchUUID(data.username);
            premium = !!mojangUUID;
            uuid = mojangUUID ?? createUUIDv3(data.username);
        }

        client.api.usersAwaitingVerification.set(data.code, {
            uuid,
            username: data.username,
            premium,
            serverId: server.id,
        });
        setTimeout(() => client.api.usersAwaitingVerification.delete(data.code), 180_000);
    }
}
