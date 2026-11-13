import MinecraftData from 'minecraft-data';
import keys from './keys.js';
import advancementData from '../resources/data/advancements.json' with { type: 'json' };
import customStats from '../resources/data/stats_custom.json' with { type: 'json' };
import { ProtocolError } from '../structures/protocol/Protocol.js';
import { handleProtocolResponse } from './protocol-utils.js';
import { nbtBufferToObject, nbtStringToObject } from './nbt-utils.js';

export const MinecraftDataVersion = '1.21.8';

/**
 * A Map object used to cache MinecraftData instances by their version for efficient reuse.
 * @type {Map<String, MinecraftData>}
 */
const mcDataCache = new Map();

/**
 * Returns a MinecraftData instance for the given version, cached for reuse.
 * Falls back to {@link MinecraftDataVersion} if the requested version is unsupported.
 * @param {string} [version] - The Minecraft version string (e.g. "1.21", "26.1"). Defaults to MinecraftDataVersion.
 * @returns {import('minecraft-data').IndexedData}
 * @throws {Error} If neither the requested version nor {@link MinecraftDataVersion} is supported by minecraft-data.
 */
export function getMinecraftData(version) {
    version ??= MinecraftDataVersion;
    if(mcDataCache.has(version)) return mcDataCache.get(version);

    // MinecraftData() returns null (doesn't throw) for an unresolvable version, e.g. snapshots/build ids.
    const data = MinecraftData(version);
    if(!data) {
        if(version !== MinecraftDataVersion) return getMinecraftData(MinecraftDataVersion);
        throw new Error(`minecraft-data does not support version ${version}`);
    }

    mcDataCache.set(version, data);
    return data;
}

const mcData = getMinecraftData(MinecraftDataVersion);

/** Player names Mojang accepts. Anything else (e.g. Floodgate-prefixed Bedrock names) can't have a Java skin. */
const MINECRAFT_USERNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;

/**
 * Returns the public base url of this bot's API, under which `/avatar/:id` serves rendered player heads.
 * Uses `PUBLIC_URL`, falling back to the origin of `LINKED_ROLES_REDIRECT_URI` (which already points at the API).
 * @returns {?string} The base url without a trailing slash, or `null` if none is configured.
 */
export function getPublicApiURL() {
    if(process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
    try {
        return new URL(process.env.LINKED_ROLES_REDIRECT_URI).origin;
    }
    catch(err) {
        return null;
    }
}

/**
 * Looks up the skin texture hash of a player directly from Mojang: username → uuid via `api.mojang.com`, then the
 * session profile's `textures` property via `sessionserver.mojang.com`.
 * @param {string} username - The player's username.
 * @returns {Promise<{ hash: ?string, definitive: boolean }>} `hash` is the texture hash, or `null` if the player
 * doesn't exist or has no custom skin. `definitive` is `false` when the lookup failed (network error, rate limit),
 * so callers can retry sooner.
 */
export async function fetchSkinTextureHash(username) {
    if(!MINECRAFT_USERNAME_REGEX.test(username ?? '')) return { hash: null, definitive: true };

    try {
        const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
        if(profileRes.status === 404 || profileRes.status === 204) return { hash: null, definitive: true };
        if(!profileRes.ok) return { hash: null, definitive: false };
        const { id } = await profileRes.json();
        if(!id) return { hash: null, definitive: true };

        const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`);
        if(sessionRes.status === 404 || sessionRes.status === 204) return { hash: null, definitive: true };
        if(!sessionRes.ok) return { hash: null, definitive: false };
        const session = await sessionRes.json();

        const texturesProperty = session.properties?.find(p => p.name === 'textures')?.value;
        if(!texturesProperty) return { hash: null, definitive: true };
        const skinURL = JSON.parse(Buffer.from(texturesProperty, 'base64').toString('utf8')).textures?.SKIN?.url;
        if(!skinURL) return { hash: null, definitive: true }; // Default skin

        const hash = new URL(skinURL).pathname.split('/').pop().toLowerCase();
        return { hash, definitive: true };
    }
    catch(err) {
        return { hash: null, definitive: false };
    }
}

/**
 * Builds the url of a rendered player head served by this bot's API (see `api/routes/Avatar.js`).
 * @param {string} id - The skin texture hash or `steve`.
 * @returns {?string} The url, or `null` if no public API url is configured.
 */
export function getAvatarURLForTexture(id) {
    const base = getPublicApiURL();
    return base ? `${base}/avatar/${id}.png` : null;
}

/**
 * Retrieves a url to the head avatar of the given player, rendered from their Mojang skin. Falls back to Steve if
 * the player doesn't exist, has no custom skin, or the lookup fails.
 * @param {string} username - The username to get the avatar for.
 * @returns {Promise<?string>} - The url of the avatar, or `null` if no public API url is configured.
 */
export async function getMinecraftAvatarURL(username) {
    return (await resolveAvatar(username)).url;
}

/**
 * @param {string} username
 * @returns {Promise<{ url: ?string, definitive: boolean }>}
 */
async function resolveAvatar(username) {
    const { hash, definitive } = await fetchSkinTextureHash(username);
    return { url: getAvatarURLForTexture(hash ?? 'steve'), definitive };
}

const AVATAR_CACHE_TTL_MS = 60 * 60_000; // 1 hour
const AVATAR_FAILURE_CACHE_TTL_MS = 5 * 60_000; // 5 minutes for failed lookups
const AVATAR_CACHE_MAX_SIZE = 5000;

/**
 * @type {Map<string, { url: ?string, expiresAt: number }>}
 */
const avatarCache = new Map();

/**
 * In-flight lookups keyed by lowercased username so concurrent callers share one Mojang request.
 * @type {Map<string, Promise<?string>>}
 */
const pendingAvatars = new Map();

/**
 * Returns a cached Minecraft avatar URL, only querying Mojang when the cache is expired or missing.
 * @param {string} player - The player username.
 * @returns {Promise<?string>} The avatar URL.
 */
export async function getCachedAvatarURL(player) {
    const key = String(player).toLowerCase();
    const cached = avatarCache.get(key);
    if(cached && Date.now() < cached.expiresAt) return cached.url;
    if(pendingAvatars.has(key)) return await pendingAvatars.get(key);

    const promise = resolveAvatar(player).then(({ url, definitive }) => {
        avatarCache.delete(key); // Re-insert to keep insertion order ~ recency for eviction
        avatarCache.set(key, {
            url,
            expiresAt: Date.now() + (definitive ? AVATAR_CACHE_TTL_MS : AVATAR_FAILURE_CACHE_TTL_MS),
        });

        // Evict oldest entries when cache grows too large
        if(avatarCache.size > AVATAR_CACHE_MAX_SIZE) {
            const deleteCount = avatarCache.size - AVATAR_CACHE_MAX_SIZE;
            const iterator = avatarCache.keys();
            for(let i = 0; i < deleteCount; i++) avatarCache.delete(iterator.next().value);
        }
        return url;
    });

    pendingAvatars.set(key, promise);
    try {
        return await promise;
    }
    finally {
        pendingAvatars.delete(key);
    }
}

/**
 * @typedef {object} AdvancementData
 * @property {string} name - The name of the advancement.
 * @property {string} value - The id of the advancement.
 * @property {string} category - The category of the advancement.
 * @property {string} description - The description of the advancement.
 */

/**
 * @typedef {object} StatData
 * @property {string} name - The name of the stat.
 * @property {string} value - The id of the stat.
 * @property {string} category - The category of the stat.
 */

/**
 * Searches for matching advancements in the given category.
 * @param {string} searchString - The advancement to search for.
 * @param {'end'|'story'|'nether'|'adventure'|'husbandry'} category - The category to search in.
 * @param {boolean} [shouldSearchNames=true] - Whether to search for matching names.
 * @param {boolean} [shouldSearchValues=true] - Whether to search for matching values.
 * @param {number} [maxLength=25] - The maximum amount of results to return.
 * @returns {AdvancementData[]} - An array of matching advancements.
 */
export function searchAdvancements(searchString, category, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    const matchingCategory = advancementData[category];
    if(!matchingCategory) return [];

    let matchingTitles = matchingCategory.filter(advancement => {
        //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value
        let match;
        if(shouldSearchNames) match = advancement.name.toLowerCase().includes(searchString.toLowerCase());
        if(shouldSearchValues && !match) match = advancement.value.includes(searchString.toLowerCase());

        return match;
    });

    //Add category field
    const categoryKey = Object.keys(advancementData).find(key => advancementData[key] === matchingCategory);
    matchingTitles.map(title => title.category = categoryKey);

    matchingTitles = [...new Set(matchingTitles)]; //Remove duplicates
    if(matchingTitles.length >= maxLength) matchingTitles.length = maxLength;
    return matchingTitles;
}

/**
 * Searches for matching advancements in all categories.
 * @param {string} searchString - The advancement to search for.
 * @param {boolean} [shouldSearchNames=true] - Whether to search for matching names.
 * @param {boolean} [shouldSearchValues=true] - Whether to search for matching values.
 * @param {number} [maxLength=25] - The maximum amount of results to return.
 * @returns {AdvancementData[]}
 */
export function searchAllAdvancements(searchString, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    let matchingTitles = [];

    for(const category of Object.keys(advancementData)) {
        const matchingKeys = searchAdvancements(searchString, category, shouldSearchNames, shouldSearchValues, maxLength);
        matchingKeys.forEach(key => matchingTitles.push(key));
    }

    matchingTitles = [...new Set(matchingTitles)]; //Remove duplicates
    if(matchingTitles.length >= maxLength) matchingTitles.length = maxLength;
    return matchingTitles;
}

/**
 * Searches for matching stats in the given category.
 * @param {string} searchString - The stat to search for.
 * @param {'mined'|'broken'|'crafted'|'used'|'picked_up'|'dropped'|'killed'|'killed_by'|'custom'} category - The category to search in.
 * @param {boolean} [shouldSearchNames=true] - Whether to search for matching names.
 * @param {boolean} [shouldSearchValues=true] - Whether to search for matching values.
 * @param {number} [maxLength=25] - The maximum amount of results to return.
 * @returns {StatData[]}
 */
export function searchStats(searchString, category, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    let dataList;
    let matchingStats = [];

    if(category === 'mined') dataList = mcData.blocksArray;
    else if(category === 'broken' || category === 'crafted' || category === 'used' || category === 'picked_up' || category === 'dropped') dataList = mcData.itemsArray;
    else if(category === 'killed' || category === 'killed_by') dataList = mcData.entitiesArray;

    if(dataList) {
        matchingStats = dataList.filter(data => {
            //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value
            let match = false;
            if(shouldSearchNames) match = data.displayName.toLowerCase().includes(searchString.toLowerCase());
            if(shouldSearchValues && !match) match = data.name.includes(searchString.toLowerCase());

            return match;
        }).map(data => {
            return {
                name: data.displayName,
                value: data.name,
                category,
            };
        });

        matchingStats = [...new Set(matchingStats)]; //Remove duplicates
        if(matchingStats.length >= maxLength) matchingStats.length = maxLength; //Reduce length

        return matchingStats;
    }
    else if(category === 'custom') {
        matchingStats = customStats.stats.filter(stat => {
            //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value
            let match = false;
            if(shouldSearchNames) match = stat.name.toLowerCase().includes(searchString.toLowerCase());
            if(!match && shouldSearchValues) match = stat.value.includes(searchString.toLowerCase());

            return match;
        }).map(stat => {
            return {
                name: stat.name,
                value: stat.value,
                category,
            };
        });
        matchingStats = [...new Set(matchingStats)]; //Remove duplicates
        if(matchingStats.length >= maxLength) matchingStats.length = maxLength; //Reduce length

        return matchingStats;
    }
    else return [];
}

/**
 * Searches for matching stats in all categories.
 * @param {string} searchString - The stat to search for.
 * @param {boolean} [shouldSearchNames=true] - Whether to search for matching names.
 * @param {boolean} [shouldSearchValues=true] - Whether to search for matching values.
 * @param {number} [maxLength=25] - The maximum amount of results to return.
 * @returns {StatData[]}
 */
export function searchAllStats(searchString, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    let matchingStats = [];

    //                 Blocks     Items   Entities   Custom
    const statLists = ['mined', 'broken', 'killed', 'custom'];

    for(const list of statLists) {
        const matchingKeys = searchStats(searchString, list, shouldSearchNames, shouldSearchValues, maxLength);
        matchingKeys.forEach(key => matchingStats.push(key));
    }

    matchingStats = [...new Set(matchingStats)]; //Remove duplicates
    if(matchingStats.length >= maxLength) matchingStats.length = maxLength;
    return matchingStats;
}

/**
 * Gets the live player nbt data from the server.
 * If the server is connected using the plugin and the player is online it will use the getPlayerNbt endpoint, otherwise (or if previous method fails) it will download the nbt file.
 * Falls back to cached data if the server is offline.
 * @param {ServerConnection} server - The server to get the nbt data from.
 * @param {UserResponse} user - The uuid of the player.
 * @param {?TranslatedResponses} interaction - The interaction to respond to in case of an error.
 * @returns {Promise<?{data: Object, cached: boolean}>} - The parsed and simplified nbt data with a cached flag, or null if an error occurred.
 */
export async function getLivePlayerNbt(server, user, interaction) {
    const playerNbtResponse = await server.protocol.getPlayerNbt(user.uuid);
    if(playerNbtResponse?.status === 'success' && playerNbtResponse.data.data !== '') {
        const parsed = nbtStringToObject(playerNbtResponse.data.data, null);
        if(parsed) return { data: parsed, cached: false };
        // else fall back to downloading the nbt file
    }

    const nbtResponse = await server.files.playerData(user.uuid);

    // handleProtocolResponse if interaction is set, otherwise manually check the status code
    if(interaction && !await handleProtocolResponse(nbtResponse, server.protocol, interaction, {
        [ProtocolError.NOT_FOUND]: keys.api.command.warnings.could_not_download_user_files,
    }, { category: 'nbt' })) return null;
    else if(nbtResponse?.status === 'success') {
        const parsed = await nbtBufferToObject(nbtResponse.data, interaction);
        return parsed ? { data: parsed, cached: nbtResponse.cached ?? false } : null;
    }
    else return null;
}

/**
 * Creates a JS object from a properties string.
 * @param {string} properties - The properties string to create the object from.
 * @returns {object} - The created object.
 */
export function parseProperties(properties) {
    const parsedProperties = {};

    for(const property of properties.split('\n')) {
        const [name, value] = property.split('=');
        if(!name || !value || name.startsWith('#')) continue;
        const trimmedValue = value.trim();
        const trimmedName = name.trim();
        if(trimmedName === '' || trimmedValue === '') continue;

        //Parse booleans and numbers
        if(trimmedValue === 'true') parsedProperties[trimmedName] = true;
        else if(trimmedValue === 'false') parsedProperties[trimmedName] = false;
        else if(!isNaN(Number(trimmedValue))) parsedProperties[trimmedName] = Number(trimmedValue);
        else parsedProperties[trimmedName] = trimmedValue;
    }

    return parsedProperties;
}

/**
 * Matches a trailing `dimensions/<namespace>/<dimension>` segment of a path. The leading separator is
 * required, so that a relative path which only consists of that segment can never be reduced to nothing.
 * @type {RegExp}
 */
const dimensionSuffix = /[\\/]dimensions[\\/][^\\/]+[\\/][^\\/]+[\\/]*$/i;

/**
 * Normalizes a world path reported by the plugin to the root of the world folder.
 * Since minecraft 26.1 the overworld is stored in `<world>/dimensions/minecraft/overworld`, so outdated
 * plugin versions report that dimension folder instead of the world root. All world paths of
 * {@link ServerFiles} are relative to the world root, which is why this is applied once when the
 * world path is received in {@link ServerConnection#_patch}. This method is idempotent and does not
 * modify paths that already point at the world root.
 * @param {?string} worldPath - The world path reported by the plugin. Non-strings are returned unchanged.
 * @returns {?string} - The path to the world root.
 */
export function normalizeWorldPath(worldPath) {
    if(typeof worldPath !== 'string' || worldPath === '') return worldPath;

    const worldRoot = worldPath.replace(dimensionSuffix, '');
    return worldRoot === '' ? worldPath : worldRoot;
}

/**
 * The dimension a numeric id refers to, as written by minecraft versions before 1.16.
 * @type {Readonly<Object<number, string>>}
 */
export const NumericDimensions = Object.freeze({
    '-1': 'the_nether',
    '0': 'overworld',
    '1': 'the_end',
});

/**
 * Normalizes a dimension from player or level NBT to its bare name (e.g. "overworld").
 * Stored as an int (-1, 0, 1) before 1.16 and a namespaced string from 1.16, so calling string methods on
 * the raw tag throws on older servers.
 * @param {?string|?number} dimension - The raw dimension value from NBT.
 * @returns {?string} The dimension name without its namespace, or null if there is no usable value.
 */
export function normalizeDimension(dimension) {
    if(dimension === null || dimension === undefined) return null;
    if(typeof dimension === 'number') return NumericDimensions[dimension] ?? null;
    if(typeof dimension !== 'string') return null;
    return dimension.replace('minecraft:', '');
}

/**
 * Compares two Minecraft version strings (e.g. "1.21", "1.21.3", "26.1").
 * Only major.minor.fix are compared, any build or snapshot suffix (e.g. "1.21.1-R0.1-SNAPSHOT", which
 * outdated plugin versions send) is ignored. A missing or unparsable version is treated as older than
 * every real version, so that callers fall back to their oldest supported behaviour instead of throwing.
 * @param {?string} a - The first version.
 * @param {?string} b - The second version.
 * @returns {-1|0|1} Negative if a < b, zero if equal, positive if a > b.
 */
export function compareMinecraftVersions(a, b) {
    const parseVersion = version => String(version ?? '').split('.').slice(0, 3)
        .map(part => Number.parseInt(part, 10) || 0);
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for(let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if(diff !== 0) return diff < 0 ? -1 : 1;
    }
    return 0;
}

/**
 * Stringifies a minecraft json object to a string.
 * @example "Hello §aWorld§r!" -> "Hello World"
 * @example {"text":"Hello §aWorld§r!"} -> "Hello World"
 * @example [{"text":"Hello "},{"text":"World","color":"green"},{"text":"!"}] -> "Hello World!"
 * @param {Object|string|Array} json - The minecraft json object to stringify. This can be a string, an object or an array of objects.
 * @param {boolean} [stripColors=true] - Whether to strip color codes from the string.
 * @returns {?string} - The stringified json or null if the input was invalid.
 */
export function stringifyMinecraftJson(json, stripColors = true) {
    const runStripColors = text => stripColors ? text.replace(/§[0-9a-fk-or]/g, '') : text;

    if(typeof json === 'string' && json.startsWith('"')) return runStripColors(json.replace(/^"|"$/g, '')); //Remove quotes at the start and end of the string
    else if(typeof json === 'string' && (json.startsWith('{') || json.startsWith('['))) {
        try {
            return stringifyMinecraftJson(JSON.parse(json));
        }
        catch(err) {
            return null;
        }
    }
    else if(Array.isArray(json))
        return runStripColors(json.map(item => item.text).join(''));
    else if(typeof json === 'object') return runStripColors(json.text);
    else return json;
}
