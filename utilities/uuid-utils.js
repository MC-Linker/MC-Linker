import crypto from 'crypto';
import rootLogger from './logger/logger.js';
import features from './logger/features.js';
import { trackError } from '../structures/analytics/AnalyticsCollector.js';

const logger = rootLogger.child({ feature: features.utilities.utils });

export const UUIDRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-5][0-9a-f]{3}-?[089ab][0-9a-f]{3}-?[0-9a-f]{12}$/i;

/**
 * Fetches the uuid of the given username from the Mojang API.
 * @param {string} username - The username to fetch the uuid for.
 * @returns {Promise<?string>} - The uuid or undefined if the user doesn't exist.
 */
export async function fetchUUID(username) {
    try {
        const data = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
            .then(data => data.json());

        if(!data.id) return undefined;
        return addHyphen(data.id);
    }
    catch(err) {
        return undefined;
    }
}

/**
 * Fetches the username of the given uuid from the Mojang API.
 * @param {string} uuid - The uuid to fetch the username for.
 * @returns {Promise<?string>} - The username or undefined if the user doesn't exist.
 */
export async function fetchUsername(uuid) {
    try {
        const data = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
            .then(data => data.json());

        return data?.name;
    }
    catch(err) {
        return undefined;
    }
}

/**
 * Fetches the floodgate (geyser) uuid of the given username from the XBL API.
 * @param {string} username - The username to fetch the uuid for.
 * @returns {Promise<?string>} - The floodgate uuid or undefined if the user doesn't exist.
 */
export async function fetchFloodgateUUID(username) {
    try {
        const data = await fetch(`https://api.geysermc.org/v2/xbox/xuid/${username}`)
            .then(data => data.json());

        if(!data?.xuid) return undefined;
        /** @type {number} */
        const xuid = data.xuid;
        // Floodate UUID Format: 00000000-0000-0000-000x-xxxxxxxxxxxx (xuid)
        const uuid = `0000000000000000000${xuid.toString(16)}`;
        return addHyphen(uuid);
    }
    catch(err) {
        trackError('unhandled', 'utils', null, null, err, null, logger);
        return undefined;
    }
}


export function addHyphen(uuid) {
    if(uuid.length !== 32) return uuid; //Already has hyphens
    uuid = [...uuid];
    for(let i = 8; i <= 23; i += 5) uuid.splice(i, 0, '-');
    return uuid.join('');
}

export function createUUIDv3(username) {
    const hash = crypto.createHash('md5');
    hash.update(`OfflinePlayer:${username}`);
    const digest = hash.digest();

    digest[6] = digest[6] & 0x0f | 0x30;  // set version to 3
    digest[8] = digest[8] & 0x3f | 0x80;  // set variant to 2

    return addHyphen(digest.toString('hex'));
}
