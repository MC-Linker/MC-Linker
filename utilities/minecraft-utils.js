import MinecraftData from 'minecraft-data';
import keys from './keys.js';
import advancementData from '../resources/data/advancements.json' with { type: 'json' };
import customStats from '../resources/data/stats_custom.json' with { type: 'json' };
import { FilePath, ProtocolError } from '../structures/protocol/Protocol.js';
import { handleProtocolResponse } from './protocol-utils.js';

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
 */
export function getMinecraftData(version) {
    version ??= MinecraftDataVersion;
    if(mcDataCache.has(version)) return mcDataCache.get(version);
    try {
        const data = MinecraftData(version);
        mcDataCache.set(version, data);
        return data;
    }
    catch {
        // Version not in minecraft-data; fall back
        if(version !== MinecraftDataVersion) return getMinecraftData(MinecraftDataVersion);
        throw new Error(`minecraft-data does not support version ${version}`);
    }
}

const mcData = getMinecraftData(MinecraftDataVersion);

/**
 * Retrieves a url to the minecraft avatar for the given username. If the user doesn't exist, this will return steve's avatar.
 * @param {string} username - The username to get the avatar for.
 * @returns {Promise<string>} - The url of the avatar.
 */
export async function getMinecraftAvatarURL(username) {
    const url = `https://minotar.net/helm/${username}`;
    try {
        const res = await fetch(url);
        //If the user doesn't exist, return steve
        if(res.status === 404) return url.replace(username, 'MHF_STEVE');
        return url;
    }
    catch(err) {
        return url.replace(username, 'MHF_STEVE');
    }
}

const AVATAR_CACHE_TTL_MS = 60 * 60_000; // 1 hour
const AVATAR_CACHE_MAX_SIZE = 5000;

/**
 * @type {Map<string, { url: string, cachedAt: number }>}
 */
const avatarCache = new Map();

/**
 * Returns a cached Minecraft avatar URL, only making the HTTP call when the cache is expired or missing.
 * @param {string} player - The player username.
 * @returns {Promise<string>} The avatar URL.
 */
export async function getCachedAvatarURL(player) {
    const cached = avatarCache.get(player);
    if(cached && Date.now() - cached.cachedAt < AVATAR_CACHE_TTL_MS) return cached.url;

    const url = await getMinecraftAvatarURL(player);
    avatarCache.set(player, { url, cachedAt: Date.now() });

    // Evict oldest entries when cache grows too large
    if(avatarCache.size > AVATAR_CACHE_MAX_SIZE) {
        const deleteCount = avatarCache.size - AVATAR_CACHE_MAX_SIZE;
        const iterator = avatarCache.keys();
        for(let i = 0; i < deleteCount; i++) avatarCache.delete(iterator.next().value);
    }

    return url;
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

    const nbtResponse = await server.protocol.getWithCache(...FilePath.PlayerData(server.worldPath, user.uuid));

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
 * Gets the configured floodgate prefix of a server by downloading the floodgate config file.
 * @param {import('../structures/protocol/Protocol.js')} protocol - The protocol to get the config with.
 * @param {string} path - The path to the server.
 * @param {string} id - The id of the server.
 * @returns {Promise<?string>} - The configured prefix or undefined if floodgate is not installed or an error occurred.
 */
export async function getFloodgatePrefix(protocol, path, id) {
    const response = await protocol.get(...FilePath.FloodgateConfig(path, id));
    if(response?.status === 'success') {
        //parse yml without module
        const searchKey = 'username-prefix:';
        const lines = response.data.toString().split('\n');
        for(const line of lines) {
            if(line.startsWith(searchKey)) {
                return line.substring(searchKey.length).trim()
                    // Remove quotes at the start and end of the string
                    .replace(/^["'](.+(?=["']$))["']$/, '$1');
            }
        }
    }
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
 * Compares two Minecraft version strings (e.g. "1.21", "1.21.3", "26.1").
 * @param {string} a - The first version.
 * @param {string} b - The second version.
 * @returns {-1|0|1} Negative if a < b, zero if equal, positive if a > b.
 */
export function compareMinecraftVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
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
