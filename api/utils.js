const PluginProtocol = require('../structures/PluginProtocol');
const {
    CommandInteraction,
    ApplicationCommandOptionType,
    User,
    MessageMentions,
    BaseInteraction,
    MessagePayload,
} = require('discord.js');
const fetch = require('node-fetch');
const crypto = require('crypto');
const mcData = require('minecraft-data')('1.19.2');
const FtpProtocol = require('../structures/FtpProtocol');
const { keys } = require('./keys');

const advancementData = require('../resources/data/advancements.json');
const customStats = require('../resources/data/stats_custom.json');
const nbt = require('prismarine-nbt');
const { ph } = require('./messages');

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
function searchAdvancements(searchString, category, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    const matchingCategory = advancementData.categories[category];
    if(!matchingCategory) return [];

    let matchingTitles = matchingCategory.filter(advancement => {
        //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value
        let match;
        if(shouldSearchNames) match = advancement.name.toLowerCase().includes(searchString.toLowerCase());
        if(shouldSearchValues && !match) match = advancement.value.includes(searchString.toLowerCase());

        return match;
    });

    //Add category field
    const categoryKey = Object.keys(advancementData.categories).find(key => advancementData.categories[key] === matchingCategory);
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
function searchAllAdvancements(searchString, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    let matchingTitles = [];

    for(const category of Object.keys(advancementData.categories)) {
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
function searchStats(searchString, category, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    let dataList;
    let matchingStats = [];

    if(category === 'mined') dataList = mcData.blocksArray;
    else if(category === 'broken' || category === 'crafted' || category === 'used' || category === 'picked_up' || category === 'dropped') dataList = mcData.itemsArray;
    else if(category === 'killed' || category === 'killed_by') dataList = mcData.entitiesArray;

    if(dataList) {
        matchingStats = dataList.filter(data => {
            //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value or category.value
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
            //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value or category.value
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
function searchAllStats(searchString, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    let matchingStats = [];

    //                        Blocks     Items   Entities   Custom
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
 * @returns {Promise<?string>}
 */
async function fetchUUID(username) {
    try {
        let data = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
            .then(data => data.json());

        return addHyphen(data.id);
    }
    catch(err) {
        return undefined;
    }
}

function addHyphen(uuid) {
    uuid = [...uuid];
    for(let i = 8; i <= 23; i += 5) uuid.splice(i, 0, '-');
    return uuid.join('');
}


/**
 * Gets an array of arguments from a CommandInteraction.
 * @param {CommandInteraction} interaction - The interaction to get the arguments from.
 * @returns {Promise<string[]>|string[]}
 */
async function getArgs(interaction) {
    if(!(interaction instanceof CommandInteraction)) return [];

    // Use guild commands if bot is not public (test-bot)
    const commandManager = interaction.client.application.botPublic ? interaction.client.application.commands : interaction.guild.commands;
    const slashCommand = await commandManager.fetch(interaction.commandId);

    const args = [];

    function addArgs(allOptions, option, incrementIndex) {
        const optIndex = allOptions.findIndex(opt => opt.name === option.name) + incrementIndex;

        if(option.type === ApplicationCommandOptionType.SubcommandGroup || option.type === ApplicationCommandOptionType.Subcommand) {
            args.push(option.name);
            option.options.forEach(opt => addArgs(slashCommand.options[optIndex].options, opt, 1));
        }
        else if(option.type === ApplicationCommandOptionType.Channel) args[optIndex] = option.channel;
        else if(option.type === ApplicationCommandOptionType.User) args[optIndex] = option.user;
        else if(option.type === ApplicationCommandOptionType.Role) args[optIndex] = option.role;
        else if(option.type === ApplicationCommandOptionType.Attachment) args[optIndex] = option.attachment;
        else args[optIndex] = option.value;
    }

    interaction.options.data.forEach(option => addArgs(slashCommand.options, option, 0));

    return args;
}

/**
 * Gets a list of users from a string of mentions.
 * @param {Client} client - The client to use.
 * @param {string} mention - The string of mentions.
 * @returns {Promise<User[]>}
 */
async function getUsersFromMention(client, mention) {
    if(typeof mention !== 'string') return [];

    const usersPattern = new RegExp(MessageMentions.UsersPattern.source, 'g');
    const matches = mention.matchAll(usersPattern);
    if(!matches) return [];

    const userArray = [];
    for(let match of matches) {
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
 * @param {(BaseInteraction|Message) & TranslatedResponses} interaction - The interaction to respond to.
 * @param {Object.<int, MessagePayload>} [statusResponses={400: MessagePayload,401: MessagePayload,404: MessagePayload}] - The responses to use for each status code.
 * @returns {Promise<boolean>} - Whether the response was successful.
 */
async function handleProtocolResponse(response, protocol, interaction, statusResponses = {}) {
    const placeholders = { data: JSON.stringify(response?.data ?? '') };

    if(!response && protocol instanceof PluginProtocol) {
        await interaction.replyTl(keys.api.plugin.errors.no_response, placeholders);
        return false;
    }
    else if(!response && protocol instanceof FtpProtocol) {
        await interaction.replyTl(keys.api.ftp.errors.could_not_connect, placeholders);
        return false;
    }
    else if(response.status >= 500 && response.status < 600) {
        await interaction.replyTl(keys.api.plugin.errors.status_500, placeholders);
        return false;
    }
    else {
        const responseKey = statusResponses[response.status] ?? defaultStatusRespones[response.status];
        if(responseKey) {
            await interaction.replyTl(responseKey, placeholders);
            return false;
        }
    }

    return true;
}

/**
 * Handles multiple responses of protocol calls.
 * @param {?ProtocolResponse[]} responses - The responses to handle.
 * @param {Protocol} protocol - The protocol that was called.
 * @param {(BaseInteraction|Message) & TranslatedResponses} interaction - The interaction to respond to.
 * @param {Object.<int, MessagePayload>} [statusResponses={400: MessagePayload,401: MessagePayload,404: MessagePayload}] - The responses to use for each status code.
 * @returns {Promise<boolean>} - Whether all responses were successful.
 */
async function handleProtocolResponses(responses, protocol, interaction, statusResponses = {}) {
    for(const response of responses) {
        if(!await handleProtocolResponse(response, protocol, interaction, statusResponses)) return false;
    }
    return true;
}

function createUUIDv3(username) {
    const hash = crypto.createHash('md5');
    hash.update(`OfflinePlayer:${username}`);
    let digest = hash.digest();

    digest[6] = digest[6] & 0x0f | 0x30;  // set version to 3
    digest[8] = digest[8] & 0x3f | 0x80;  // set variant to 2

    return addHyphen(digest.toString('hex'));
}

/**
 * Creates a JS object from an nbt buffer.
 * @param {Buffer} buffer - The nbt buffer to create the object from.
 * @param {TranslatedResponses} interaction - The interaction to respond to.
 * @returns {Promise<object|undefined>} - The created object or undefined if an error occurred.
 */
async function nbtBufferToObject(buffer, interaction) {
    try {
        const object = await nbt.parse(buffer, 'big');
        return nbt.simplify(object.parsed);
    }
    catch(err) {
        await interaction.replyTl(keys.api.ftp.errors.could_not_parse, ph.error(err));
        return undefined;
    }
}

/**
 * Creates a JS object from a properties string.
 * @param {string} properties - The properties string to create the object from.
 * @returns {object} - The created object.
 */
function parseProperties(properties) {
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
const formattingCodes = ['l', 'm', 'n', 'o', 'r', 'k'];

/**
 * Parses a string with minecraft color codes and formatting and draws it on a canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {string} text - The text to draw.
 * @param {number} x - The x position to start drawing at.
 * @param {number} y - The y position to start drawing at.
 * @param {boolean} [shadow=true] - Whether to draw a text shadow.
 */
function drawMinecraftText(ctx, text, x, y, shadow = true) {
    //Push formatting codes to next words if they at the end of word without space
    //Example: §l§o§cHello§r§l§o§c World -> §l§o§cHello §r§l§o§cWorld
    text = text.replace(/((?:§[0-9a-fk-or])+)\s+/gi, ' $1');

    for(const word of text.split(/\s/)) {
        const colorCodeRegex = /§([0-9a-fk-or])/gi;
        const matches = word.matchAll(colorCodeRegex);
        let matchedWord = word.replace(colorCodeRegex, '') + ' '; //Replace color codes

        let strikethrough = false; //Strikethrough line should be drawn after the text itself is drawn
        for(const match of matches) {
            const [_, color] = match;

            if(colorCodes[color.toLowerCase()]) {
                ctx.fillStyle = colorCodes[color.toLowerCase()];
            }
            else if(formattingCodes.includes(color.toLowerCase())) {
                //Bold and italic
                if(color === 'l' || color === 'o') ctx.font = `${color === 'l' ? 'bold ' : ''}${color === 'o' ? 'italic ' : ''}${ctx.font}`;
                else if(color === 'm') { //Strikethrough
                    strikethrough = true;
                }
                else if(color === 'n') { // Underline
                    ctx.fillRect(x, y + 4, ctx.measureText(matchedWord).width, 4);
                }
                //Obfuscated
                else if(color === 'k') {
                    matchedWord = '?'.repeat(matchedWord.length);
                }
                //Reset
                else if(color === 'r') ctx.fillStyle = '#AAA';
            }
        }

        if(shadow) {
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.fillText(matchedWord, x + 4, y + 4);
            ctx.restore();
        }
        ctx.fillText(matchedWord, x, y);

        if(strikethrough) {
            ctx.fillRect(x, y - 8, ctx.measureText(matchedWord).width, 4);
        }

        x += ctx.measureText(matchedWord).width;
    }
}

/**
 * Divide an entire phrase in an array of phrases, all with the max pixel length given.
 * The words are initially separated by the space char.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {string} text - The text to draw.
 * @param {number} maxWidth - The max width of the text.
 * @returns {string[]} - The divided phrases.
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for(let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(`${currentLine} ${word}`).width;
        if(width < maxWidth) {
            currentLine += ' ' + word;
        }
        else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

module.exports = {
    searchAllAdvancements,
    searchAdvancements,
    searchAllStats,
    searchStats,
    fetchUUID,
    createUUIDv3,
    getArgs,
    getUsersFromMention,
    handleProtocolResponse,
    handleProtocolResponses,
    nbtBufferToObject,
    parseProperties,
    drawMinecraftText,
    wrapText,
};
