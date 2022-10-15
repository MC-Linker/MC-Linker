const PluginProtocol = require('../structures/PluginProtocol');
const { keys } = require('./messages');

const {
    GuildApplicationCommandManager,
    CommandInteraction,
    ApplicationCommandOptionType,
    User,
    MessageMentions,
    BaseInteraction,
    MessagePayload,
} = require('discord.js');
const fetch = require('node-fetch');
const mcData = require('minecraft-data')('1.19.2');

const advancementData = require('../resources/data/advancements.json');
const customStats = require('../resources/data/stats_custom.json');
const FtpProtocol = require('../structures/FtpProtocol');

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
 * Gets a slash command from the given manager by its name.
 * @param {GuildApplicationCommandManager|ApplicationCommandManager} commandManager - The command manager to search in.
 * @param {string} name - The name of the command to search for.
 * @returns {Promise<ApplicationCommand>}
 */
async function getSlashCommand(commandManager, name) {
    let slashCommand = commandManager.cache.find(cmd => cmd.name === name);
    if(!slashCommand) {
        const commands = await commandManager.fetch();
        return commands.find(cmd => cmd.name === name);
    }
    return slashCommand;
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

    const slashCommand = await interaction.guild.commands.fetch(interaction.commandId);

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

/**
 * The default responses to use for each status code.
 * @type {{400: MessagePayload, 401: MessagePayload, 404: MessagePayload}}}
 */
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
 * @returns {Promise<boolean>}
 */
async function handleProtocolResponse(response, protocol, interaction, statusResponses = defaultStatusRespones) {
    if(!response && protocol instanceof PluginProtocol) {
        await interaction.replyTl(keys.api.plugin.errors.no_response);
        return false;
    }
    else if(!response && protocol instanceof FtpProtocol) {
        await interaction.replyTl(keys.api.ftp.errors.could_not_connect);
        return false;
    }
    else if(response.status <= 500 && response.status < 600) {
        await interaction.replyTl(keys.api.plugin.errors.status_500);
        return false;
    }
    else {
        const responseKey = statusResponses[response.status] ?? defaultStatusRespones[response.status];
        if(responseKey) {
            await interaction.replyTl(responseKey);
            return false;
        }
    }

    return true;
}


module.exports = {
    searchAllAdvancements,
    searchAdvancements,
    searchAllStats,
    getSlashCommand,
    searchStats,
    fetchUUID,
    getArgs,
    getUsersFromMention,
    handleProtocolResponse,
};
