import Discord, {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ChannelType,
    CommandInteraction,
    ComponentType,
    GuildChannel,
    MessageMentions,
    MessagePayload,
    PermissionFlagsBits,
    PermissionsBitField,
    Routes,
    User,
} from 'discord.js';
import crypto from 'crypto';
import MinecraftData from 'minecraft-data';
import keys from './keys.js';
import advancementData from '../resources/data/advancements.json' with { type: 'json' };
import customStats from '../resources/data/stats_custom.json' with { type: 'json' };
import nbt from 'prismarine-nbt';
import { getReplyOptions, ph } from './messages.js';
import { Canvas, loadImage } from 'skia-canvas';
import emoji from 'emojione';
import mojangson from 'mojangson';
import { Authflow } from 'prismarine-auth';
import WebSocketProtocol from '../structures/WebSocketProtocol.js';
import { FilePath } from '../structures/Protocol.js';
import HttpProtocol from '../structures/HttpProtocol.js';
import FtpProtocol from '../structures/FtpProtocol.js';

export const MaxEmbedFieldValueLength = 1024;
export const MaxActionRows = 5;
export const MaxActionRowSize = 5;
export const MaxEmbedDescriptionLength = 4096;
export const MaxAutoCompleteChoices = 25;
export const UUIDRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-5][0-9a-f]{3}-?[089ab][0-9a-f]{3}-?[0-9a-f]{12}$/i;
export const MinecraftDataVersion = '1.21.3';

/** The size of each component in an action row (5 takes up the whole row) */
export const ComponentSizeInActionRow = {
    [ComponentType.Button]: 1,
    [ComponentType.StringSelect]: 5,
    [ComponentType.RoleSelect]: 5,
    [ComponentType.ChannelSelect]: 5,
    [ComponentType.UserSelect]: 5,
    [ComponentType.MentionableSelect]: 5,
    [ComponentType.TextInput]: 5,
};

const mcData = MinecraftData(MinecraftDataVersion);

// Password Auth:
const flow = process.env.MICROSOFT_EMAIL && process.env.MICROSOFT_PASSWORD && process.env.AZURE_CLIENT_ID ?
    new Authflow(process.env.MICROSOFT_EMAIL, './microsoft-cache', {
        authTitle: process.env.AZURE_CLIENT_ID,
        flow: 'msal', // required, but will be ignored because password field is set
        password: process.env.MICROSOFT_PASSWORD,
    }) : null;
// MSAL Auth:
// const flow = new Authflow('Lianecx', './microsoft-cache', { flow: 'msal' }, res => {
//     console.log(res);
// });


/**
 * Retrieves a url to the minecraft avatar for the given username. If the user doesn't exist, this will return steve's avatar.
 * @param {string} username - The username to get the avatar for.
 * @returns {Promise<string>} - The url of the avatar.
 */
export async function getMinecraftAvatarURL(username) {
    const url = `https://minotar.net/helm/${username}/64.png?rnd=${Math.random()}`; //Random query to prevent caching
    //fetch the url to check if the user exists
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
        const { userHash, XSTSToken: xstsToken } = await flow.getXboxToken();
        const data = await fetch(`https://profile.xboxlive.com/users/gt(${username})/profile/settings`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `XBL3.0 x=${userHash};${xstsToken}`,
                'x-xbl-contract-version': '3',
            },
        }).then(data => data.json());

        if(!data.profileUsers?.[0]?.id) return undefined;
        const xuid = parseInt(data.profileUsers[0].id);
        // Floodate UUID Format: 00000000-0000-0000-000x-xxxxxxxxxxxx (xuid)
        const uuid = `0000000000000000000${xuid.toString(16)}`;
        return addHyphen(uuid);
    }
    catch(err) {
        return undefined;
    }
}


export function addHyphen(uuid) {
    if(uuid.length !== 32) return uuid; //Already has hyphens
    uuid = [...uuid];
    for(let i = 8; i <= 23; i += 5) uuid.splice(i, 0, '-');
    return uuid.join('');
}


/**
 * Gets an array of arguments from a CommandInteraction.
 * @param {CommandInteraction} interaction - The interaction to get the arguments from.
 * @returns {Promise<string[]>|string[]}
 */
export async function getArgs(interaction) {
    if(!(interaction instanceof CommandInteraction)) return [];

    const slashCommand = await interaction.client.application.commands.fetch(interaction.commandId);

    const args = [];
    let incrementIndex = 0;

    function addArgs(allOptions, option) {
        //we use an index instead of push because users can select options in any order they want
        const allOptionsIndex = allOptions.findIndex(opt => opt.name === option.name);
        // Option has to be pushed further back if there are subcommands or subcommand groups before it
        const argOptionIndex = allOptions.findIndex(opt => opt.name === option.name) + incrementIndex;

        if(option.type === ApplicationCommandOptionType.SubcommandGroup || option.type === ApplicationCommandOptionType.Subcommand) {
            args.push(option.name);
            incrementIndex++;
            option.options.forEach(opt => addArgs(allOptions[allOptionsIndex].options, opt));
        }
        else if(option.type === ApplicationCommandOptionType.Channel) args[argOptionIndex] = option.channel;
        else if(option.type === ApplicationCommandOptionType.User) args[argOptionIndex] = option.user;
        else if(option.type === ApplicationCommandOptionType.Role) args[argOptionIndex] = option.role;
        else if(option.type === ApplicationCommandOptionType.Attachment) args[argOptionIndex] = option.attachment;
        else args[argOptionIndex] = option.value;
    }

    interaction.options.data.forEach(option => addArgs(slashCommand.options, option));

    return args;
}

/**
 * Gets a list of users from a string of mentions.
 * @param {Client} client - The client to use.
 * @param {string} mention - The string of mentions.
 * @returns {Promise<User[]>}
 */
export async function getUsersFromMention(client, mention) {
    if(typeof mention !== 'string') return [];

    const usersPattern = new RegExp(MessageMentions.UsersPattern.source, 'g');
    const matches = mention.matchAll(usersPattern);
    if(!matches) return [];

    const userArray = [];
    for(const match of matches) {
        // match[0] = entire mention
        // match[1] = Id
        userArray.push(await client.users.fetch(match[1]));
    }

    return userArray;
}


const defaultStatusRespones = {
    400: keys.api.plugin.errors.status_400,
    401: keys.api.plugin.errors.status_401,
    404: keys.api.plugin.errors.status_404,
};

/**
 * Handles the response of a protocol call.
 * @param {?ProtocolResponse} response - The response to handle.
 * @param {Protocol} protocol - The protocol that was called.
 * @param {TranslatedResponses} interaction - The interaction to respond to.
 * @param {Object.<int, MessagePayload>} [statusResponses={400: MessagePayload,401: MessagePayload,404: MessagePayload}] - The responses to use for each status code.
 * @param {...Object.<string, string>[]} [placeholders=[]] - The placeholders to use in the response.
 * @returns {Promise<boolean>} - Whether the response was successful.
 */
export async function handleProtocolResponse(response, protocol, interaction, statusResponses = {}, ...placeholders) {
    placeholders.push({ data: JSON.stringify(response?.data ?? '') });

    if(!response && (protocol instanceof HttpProtocol || protocol instanceof WebSocketProtocol)) {
        await interaction.replyTl(keys.api.plugin.errors.no_response, ...placeholders);
        return false;
    }
    else if(!response && protocol instanceof FtpProtocol) {
        await interaction.replyTl(keys.api.ftp.errors.could_not_connect, ...placeholders);
        return false;
    }
    else if(response.status >= 500 && response.status < 600) {
        await interaction.replyTl(keys.api.plugin.errors.status_500, ...placeholders);
        return false;
    }
    else if(response.status !== 200) {
        const responseKey = statusResponses[response.status] ?? defaultStatusRespones[response.status];
        if(responseKey) {
            await interaction.replyTl(responseKey, ...placeholders);
            return false;
        }
    }

    return true;
}

/**
 * Handles multiple responses of protocol calls.
 * @param {?ProtocolResponse[]} responses - The responses to handle.
 * @param {Protocol} protocol - The protocol that was called.
 * @param {TranslatedResponses} interaction - The interaction to respond to.
 * @param {Object.<int, MessagePayload>} [statusResponses={400: MessagePayload,401: MessagePayload,404: MessagePayload}] - The responses to use for each status code.
 * @param {...Object.<string, string>[]} [placeholders=[]] - The placeholders to use in the response.
 * @returns {Promise<boolean>} - Whether all responses were successful.
 */
export async function handleProtocolResponses(responses, protocol, interaction, statusResponses = {}, ...placeholders) {
    for(const response of responses) {
        if(!await handleProtocolResponse(response, protocol, interaction, statusResponses, ...placeholders)) return false;
    }
    return true;
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
    else if(typeof json === 'string') {
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
}


/**
 * Gets the live player nbt data from the server.
 * If the server is connected using the plugin and the player is online it will use the getPlayerNbt endpoint, otherwise (or if previous method fails) it will download the nbt file.
 * @param {ServerConnection} server - The server to get the nbt data from.
 * @param {UserResponse} user - The uuid of the player.
 * @param {?TranslatedResponses} interaction - The interaction to respond to in case of an error.
 * @returns {Promise<?Object>} - The parsed and simplified nbt data or null if an error occurred.
 */
export async function getLivePlayerNbt(server, user, interaction) {
    const onlinePlayersResponse = await server.protocol.getOnlinePlayers();
    const onlinePlayers = onlinePlayersResponse?.status === 200 ? onlinePlayersResponse.data : [];
    if(onlinePlayers.includes(user.username)) {
        const playerNbtResponse = await server.protocol.getPlayerNbt(user.uuid);
        if(playerNbtResponse?.status === 200 && playerNbtResponse.data.data !== '') {
            const parsed = nbtStringToObject(playerNbtResponse.data.data, null);
            if(parsed) return parsed;
            // else fall back to downloading the nbt file
        }
    }

    // If the server is not connected using the plugin or the player is not online or the getPlayerNbt endpoint failed, download the nbt file
    const nbtResponse = await server.protocol.get(FilePath.PlayerData(server.worldPath, user.uuid), `./download-cache/playerdata/${user.uuid}.dat`);

    // handProtocolResponse if interaction is set, otherwise manually check the status code
    if(interaction && !await handleProtocolResponse(nbtResponse, server.protocol, interaction)) return null;
    else if(nbtResponse?.status === 200) return nbtBufferToObject(nbtResponse.data, interaction);
    else return null;
}

/**
 * Gets the configured floodgate prefix of a server by downloading the floodgate config file.
 * @param {import('../structures/Protocol.js')} protocol - The protocol to get the config with.
 * @param {string} path - The path to the server.
 * @param {string} id - The id of the server.
 * @returns {Promise<?string>} - The configured prefix or undefined if floodgate is not installed or an error occurred.
 */
export async function getFloodgatePrefix(protocol, path, id) {
    const response = await protocol.get(...FilePath.FloodgateConfig(path, id));
    if(response?.status === 200) {
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

export function createUUIDv3(username) {
    const hash = crypto.createHash('md5');
    hash.update(`OfflinePlayer:${username}`);
    const digest = hash.digest();

    digest[6] = digest[6] & 0x0f | 0x30;  // set version to 3
    digest[8] = digest[8] & 0x3f | 0x80;  // set variant to 2

    return addHyphen(digest.toString('hex'));
}

/**
 * Creates a JS object from an nbt buffer.
 * @param {Buffer} buffer - The nbt buffer to create the object from.
 * @param {?TranslatedResponses} interaction - The interaction to respond to in case of an error.
 * @returns {Promise<object|undefined>} - The created object or undefined if an error occurred.
 */
export async function nbtBufferToObject(buffer, interaction) {
    try {
        const object = await nbt.parse(buffer, 'big');
        return nbt.simplify(object.parsed);
    }
    catch(err) {
        await interaction?.replyTl(keys.api.ftp.errors.could_not_parse, ph.error(err));
        return undefined;
    }
}

/**
 * Creates a JS object from a snbt string. This will also strip extra color codes from the string.
 * @param {string} string - The snbt string to create the object from.
 * @param {?TranslatedResponses} interaction - The interaction to respond to in case of an error.
 * @returns {Promise<object|undefined>} - The created object or undefined if an error occurred.
 */
export function nbtStringToObject(string, interaction) {
    try {
        const object = mojangson.parse(stripColorCodes(string));
        //remove empty inventory/ender-items to prevent error (please fix this mojangson)
        if(!object.value?.Inventory?.value?.value) delete object.value.Inventory;
        if(!object.value?.EnderItems?.value?.value) delete object.value.EnderItems;
        const simplified = mojangson.simplify(object);
        // re-add empty inventory/ender-items
        if(!simplified.Inventory) simplified.Inventory = [];
        if(!simplified.EnderItems) simplified.EnderItems = [];
        return simplified;
    }
    catch(err) {
        interaction?.replyTl(keys.api.ftp.errors.could_not_parse, ph.error(err));
        return undefined;
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


const colorCodes = {
    0: '#000',
    1: '#00A',
    2: '#0A0',
    3: '#0AA',
    4: '#A00',
    5: '#A0A',
    6: '#FA0',
    7: '#AAA',
    8: '#555',
    9: '#55F',
    a: '#5F5',
    b: '#5FF',
    c: '#F55',
    d: '#F5F',
    e: '#FF5',
    f: '#FFF',
};
const formattingCodes = ['l', 'm', 'n', 'o', 'r', 'k', 'x'];

/**
 * Parses a string with minecraft color codes and formatting and draws it on a canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {string} text - The text to draw.
 * @param {number} x - The x position to start drawing at.
 * @param {number} y - The y position to start drawing at.
 * @param {boolean} [drawShadow=false] - Whether to draw a shadow.
 */
export function drawMinecraftText(ctx, text, x, y, drawShadow = false) {
    const originalFont = ctx.font;
    ctx.save();

    let strikethrough = false;
    let underline = false;
    let obfuscated = false;
    for(let i = 0; i < text.length; i++) {
        let char = text.charAt(i);

        const colorCodeRegex = /§([0-9a-fk-orx])/i;
        const match = (char + text.charAt(i + 1)).match(colorCodeRegex);
        if(match) {
            const [_, color] = match;

            if(colorCodes[color.toLowerCase()]) {
                ctx.fillStyle = colorCodes[color.toLowerCase()];
                //Color codes reset formatting
                strikethrough = false;
                underline = false;
                obfuscated = false;
            }
            else if(formattingCodes.includes(color.toLowerCase())) {
                switch(color) {
                    case 'l':
                        ctx.font = `bold ${originalFont}`;
                        break;
                    case 'o':
                        ctx.font = `italic ${originalFont}`;
                        break;
                    case 'm':
                        strikethrough = true;
                        underline = false;
                        break;
                    case 'n':
                        underline = true;
                        strikethrough = false;
                        break;
                    case 'k':
                        obfuscated = true;
                        break;
                    case 'r':
                        ctx.fillStyle = '#AAA';
                        ctx.font = `normal ${originalFont}`;
                        strikethrough = false;
                        underline = false;
                        obfuscated = false;
                        break;
                    case 'x':
                        //Get the next 12 characters, remove the § and parse the hex color
                        // §x§f§f§0§0§0§0
                        const hex = text.substring(i + 2, i + 14).replace(/§/g, '');
                        ctx.fillStyle = `#${hex}`;
                        i += 12;
                }
            }

            i++; //Skip next char
            continue;
        }

        if(obfuscated && char !== ' ') char = '?';

        if(drawShadow) {
            const previousFillStyle = ctx.fillStyle;
            const shadowOffset = ctx.measureText(char).width / 5;

            ctx.fillStyle = '#3E3E3E';
            ctx.fillText(char, x + shadowOffset, y + shadowOffset);
            ctx.fillStyle = previousFillStyle;
        }

        ctx.fillText(char, x, y);

        if(strikethrough) ctx.fillRect(x, y - 8, ctx.measureText(char).width, 4);
        if(underline) ctx.fillRect(x, y + 4, ctx.measureText(char).width, 4);

        x += ctx.measureText(char).width;
    }

    ctx.restore();
}

const mcNumbers = await loadImage('./resources/images/misc/numbers.png');
const mcDigitSize = [5, 7];

/**
 * Draws a minecraft number on a canvas.
 * @param {import('skia-canvas').CanvasRenderingContext2D} context - The canvas context to draw on.
 * @param {int|string} num - The number to draw.
 * @param {int} x - The x position to start drawing at.
 * @param {int} y - The y position to start drawing at.
 * @param {int} width - The width of each digit.
 * @param {int} height - The height of each digit.
 */
export function drawMinecraftNumber(context, num, x = 0, y = 0, width, height) {
    num = num.toString();

    const shadowOffset = width / mcDigitSize[0];

    const canvas = new Canvas((width + shadowOffset) * num.length, height + shadowOffset);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    //Draw shadow
    for(let i = 0; i < num.length; i++)
        ctx.drawImage(mcNumbers, num[i] * mcDigitSize[0], 0, mcDigitSize[0], mcDigitSize[1], i * (width + shadowOffset) + shadowOffset, shadowOffset, width, height);

    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#3E3E3E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';
    //Draw number
    for(let i = 0; i < num.length; i++)
        ctx.drawImage(mcNumbers, num[i] * mcDigitSize[0], 0, mcDigitSize[0], mcDigitSize[1], i * (width + shadowOffset), 0, width, height);

    context.drawImage(canvas, x, y);
}

/**
 * Divide an entire phrase in an array of phrases, all with the max pixel length given.
 * The words are initially separated by the space char.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {string} text - The text to draw.
 * @param {number} maxWidth - The max width of the text.
 * @returns {string[]} - The divided phrases.
 */
export function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];

    let currentLine = words[0];
    for(const word of words) {
        if(word === words[0]) continue; //Skip first word
        const width = ctx.measureText(`${currentLine} ${word}`).width;
        if(width < maxWidth) currentLine += ` ${word}`;
        else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

const colorCodesToAnsi = {
    '4': '31', //Red
    'c': '31', //Red
    '6': '33', //Yellow
    'e': '33', //Yellow
    '2': '32', //Green
    'a': '32', //Green
    'b': '36', //Cyan
    '3': '36', //Cyan
    '1': '34', //Blue
    '9': '34', //Blue
    'd': '35', //Magenta
    '5': '35', //Magenta
    'f': '37', //White
    '7': '37', //White
    '0': '30', //Black
    '8': '30', //Black
};

const formattingCodesToAnsi = {
    'l': '1', //Bold
    'n': '4', //Underline
    'r': '0', //Reset
};

const colorPattern = /[&§]([0-9a-fk-or])/gi;

/**
 * Removes all minecraft color codes from a string.
 * @param {string} text - The text to remove color codes from.
 * @returns {string} - The text without color codes.
 */
export function stripColorCodes(text) {
    return text.replace(colorPattern, '');
}

/**
 * Creates a discord code block from a minecraft command response (with colors codes using ansi).
 * @param {string} response - The command response.
 * @returns {`\`\`\`ansi\n${string}\n\`\`\``}
 */
export function codeBlockFromCommandResponse(response) {
    // Ansi formatting vanishes with more than 1015 characters ¯\_(ツ)_/¯
    if(response.length >= 1015) response = stripColorCodes(response);
    else {
        //Parse color codes to ansi
        response = response.replace(colorPattern, (_, color) => {
            const ansi = colorCodesToAnsi[color];
            const format = formattingCodesToAnsi[color];
            if(!ansi && !format) return '';

            return `\u001b[${format ?? '0'};${ansi ?? '37'}m`;
        });
    }

    // -12 for code block (```ansi\n\n```)
    if(response.length > MaxEmbedDescriptionLength - 12) response = `${response.substring(0, MaxEmbedDescriptionLength - 15)}...`;

    //Wrap in discord code block for color
    return Discord.codeBlock('ansi', `${response}`);
}

/**
 * Converts custom discord emojis and unicode emojis to their string representation.
 * @example
 * // returns "Hello :smile:"
 * cleanEmojis('Hello 😀');
 * @param {string} message - The message to clean
 * @returns {string} - The cleaned message.
 */
export function cleanEmojis(message) {
    const cleanedMessage = emoji.toShort(message);
    return cleanedMessage.replace(/<a?(:[a-zA-Z0-9_]+:)[0-9]+>/g, '$1');
}

export function createHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Formats a duration in milliseconds to a string.
 * @param {Number} milliseconds - The duration in milliseconds.
 * @returns {String} - The formatted duration.
 * @example 1000 -> "1s"
 * @example 6006000600 -> "1h 40m 6s"
 */
export function formatDuration(milliseconds) {
    let seconds = milliseconds / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    // Round values and get remainder
    seconds = Math.floor(seconds) % 60;
    minutes = Math.floor(minutes) % 60;
    hours = Math.floor(hours) % 24;
    days = Math.floor(days);

    return `${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes ? `${minutes}m ` : ''}${seconds}s`;
}

/**
 * Formats a distance in centimeters to a string.
 * @param {Number} centimeters - The distance in centimeters.
 * @returns {String} - The formatted distance.
 * @example 1000 -> "1m"
 * @example 1234567 -> "1km 234m 567cm"
 */
export function formatDistance(centimeters) {
    let meters = centimeters / 100;
    let kilometers = meters / 1000;

    // Round values and get remainder
    meters = Math.floor(meters) % 1000;
    kilometers = Math.floor(kilometers);

    return `${kilometers ? `${kilometers}km ` : ''}${meters ? `${meters}m ` : ''}${centimeters % 100}cm`;
}

/**
 * Disables all components of an action row and returns a new one.
 * @param {ActionRow[]} rows - The message to disable the components of.
 * @returns {ActionRowBuilder[]} - An action row builder array with all components disabled.
 */
export function disableComponents(rows) {
    return rows.map(row => {
        row = ActionRowBuilder.from(row);
        const disabledComponents = row.components.map(component => component.setDisabled(true));
        row.setComponents(...disabledComponents);
        return row;
    });
}

/**
 * Flatten action rows to get all components in an array
 * @param {import('discord.js').ActionRowBuilder[]} actionRows - The action rows to flatten
 * @return {import('discord.js').ComponentBuilder[]} - An array of all components in the action rows
 * @private
 */
export function flattenActionRows(actionRows) {
    return actionRows?.flatMap(row => row.components) ?? [];
}

/**
 * Memoizes a function.
 * @template {Function} K
 * @param {K} fn - The function to memoize.
 * @param {Number=undefined} parameters - The number of parameters to use as key. Defaults to all parameters.
 * @returns {K} - The memoized function.
 */
export function memoize(fn, parameters = undefined) {
    const cache = new Map();
    return function(...args) {
        const key = JSON.stringify(args.slice(0, parameters));
        if(cache.has(key)) return cache.get(key);

        const result = fn(...args);
        if(result instanceof Promise)
            result.then(value => cache.set(key, value));
        else cache.set(key, result);

        return result;
    };
}


/**
 * Checks if a member has permission to send messages in a channel.
 * @param {GuildMember} member - The member to check.
 * @param {GuildChannel} channel - The channel to check.
 * @param {Boolean} [sendEmbed=true] - Whether the member needs to be able to send embeds.
 * @returns {Boolean} - Whether the member can send messages in the channel.
 */
export function canSendMessages(member, channel, sendEmbed = true) {
    const permissions = channel.permissionsFor(member);
    if(!permissions.has(PermissionFlagsBits.ViewChannel)) return false;

    if(channel.isThread() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads)) return false;
    else if(!permissions.has(PermissionFlagsBits.SendMessages)) return false;
    else if(sendEmbed && !permissions.has(PermissionFlagsBits.EmbedLinks)) return false;
    return true;
}

/**
 * Formats a duration in milliseconds to a string.
 * @param {Number} ms - The duration in milliseconds.
 * @returns {String} - The formatted duration.
 * @example 1000 -> "1 second"
 * @example 1000000 -> "16 minutes, 40 seconds"
 * @example 1000000000 -> "11 days, 13 hours, 46 minutes, 40 seconds"
 */
export function durationString(ms) {
    if(Number.isNaN(ms)) return 'Invalid duration';
    let seconds = ms / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;
    let weeks = days / 7;
    let years = days / 365.25; // .25 for leap years

    // Round values and get remainder
    seconds = Math.round(seconds) % 60;
    minutes = Math.round(minutes) % 60;
    hours = Math.round(hours) % 24;
    days = Math.round(days) % 7;
    weeks = Math.round(weeks) % 52;
    years = Math.round(years);

    return `${years} year${years === 1 ? '' : 's'}, ${weeks} week${weeks === 1 ? '' : 's'}, ${days} day${days === 1 ? '' : 's'}, ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        //Remove 0 values
        .replace(/(?<!\d)0\s[a-z]+,\s/g, '').replace(/(, 00:00:00)/, '');
}

/**
 * Send a message to a guild with the given key
 * This will try to send the message to the system channel first
 * If that fails, it will try to send it to the public updates channel
 * If that also fails, it will try to send it to the first text channel it finds
 * @param {Discord.Guild} guild - The guild to send the message to
 * @param {any} key - The key of the message to send
 * @param {...Object} placeholders - The placeholders to use in the message
 * @returns {Promise<void>}
 */
export async function sendToServer(guild, key, ...placeholders) {
    const replyOptions = getReplyOptions(key, ...placeholders);

    if(await trySendMessage(guild.systemChannel)) return;
    if(await trySendMessage(guild.publicUpdatesChannel)) return;

    const sortedChannels = await sortChannels(guild);
    for(const channel of sortedChannels) {
        if(await trySendMessage(channel)) return;
    }

    async function trySendMessage(channel) {
        if(!channel || !channel.isTextBased()) return false;
        try {
            await channel.send(replyOptions);
            return true;
        }
        catch {
            return false;
        }
    }
}

/**
 * Sort channels in a guild by their position
 * @param {Guild} guild - The guild to sort the channels in
 * @returns {Promise<Discord.Channel[]>}
 */
export async function sortChannels(guild) {
    const guildChannels = await guild.channels.fetch();

    //Sorting by type (text over voice) and by position
    const descendingPosition = (a, b) => {
        if(a.type === b.type) return a.position - b.position;
        else if(a.type === 'voice') return 1;
        else return -1;
    };

    const sortedChannels = [];

    /** @type {Discord.Collection<?Discord.CategoryChannel, Discord.Collection<Discord.Snowflake, Discord.CategoryChildChannel>>} */
    const channels = new Discord.Collection();

    //Push channels without category/parent
    guildChannels
        .filter(channel => !channel.parent && channel.type !== ChannelType.GuildCategory)
        .sort(descendingPosition)
        .forEach(c => sortedChannels.push(c));

    //Set Categories with their children
    /** @type {Discord.Collection<Discord.Snowflake, Discord.CategoryChannel>} */
    const categories = guildChannels.filter(channel => channel.type === ChannelType.GuildCategory).sort(descendingPosition);
    categories.forEach(category => channels.set(category, category.children.cache.sort(descendingPosition)));

    //Loop over all categories
    channels.forEach((children, category) => {
        //Push category
        if(category) sortedChannels.push(category);

        //Loop over children of categories and push children
        for(const [_, child] of children) sortedChannels.push(child);
    });

    return sortedChannels;
}

/**
 * Generates a default invite link for a bot.
 * Default Scopes:
 * - bot
 * - applications.commands
 * Default Permissions:
 * - Create Instant Invite
 * - Manage Webhooks
 * - View Channel
 * - Send Messages
 * - Send Messages in Threads
 * - Embed Links
 * - Attach Files
 * - Use External Emojis
 * @param {string} botId - The id of the bot to generate the invite for.
 * @return {'https://discord.com/api/oauth2/authorize?client_id=${botId}&scope=${scopes}&permissions=${permissions}'}
 */
export function generateDefaultInvite(botId) {
    const permissions = PermissionsBitField.Flags.CreateInstantInvite |
        PermissionsBitField.Flags.ManageWebhooks |
        PermissionsBitField.Flags.ViewChannel |
        PermissionsBitField.Flags.SendMessages |
        PermissionsBitField.Flags.SendMessagesInThreads |
        PermissionsBitField.Flags.EmbedLinks |
        PermissionsBitField.Flags.AttachFiles |
        PermissionsBitField.Flags.UseExternalEmojis;

    return `https://discord.com/api/${Routes.oauth2Authorization()}?client_id=${botId}&scope=bot%20applications.commands&permissions=${permissions}`;
}