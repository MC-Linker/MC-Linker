const fetch = require('node-fetch');
const mcData = require('minecraft-data')('1.19.2');

const advancementData = require('../resources/data/advancements.json');
const customStats = require('../resources/data/stats_custom.json');

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
            };
        }); //Only include displayName and name

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
        });
        matchingStats = [...new Set(matchingStats)]; //Remove duplicates
        if(matchingStats.length >= maxLength) matchingStats.length = maxLength; //Reduce length

        return matchingStats;
    }
    else return [];
}

function searchAllStats(searchString, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    return new Promise(async resolve => {
        let matchingStats = [];

        //                        Blocks     Items   Entities   Custom
        const statLists = ['mined', 'broken', 'killed', 'custom'];

        for(const list of statLists) {
            const matchingKeys = await searchStats(searchString, list, shouldSearchNames, shouldSearchValues, maxLength);
            matchingKeys.forEach(key => matchingStats.push(key));
            console.log(matchingStats);
        }

        matchingStats = [...new Set(matchingStats)]; //Remove duplicates
        if(matchingStats.length >= maxLength) matchingStats.length = maxLength;
        resolve(matchingStats);
    });
}

/**
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

module.exports = {
    searchAllAdvancements,
    searchAdvancements,
    searchAllStats,
    getSlashCommand,
    searchStats,
    fetchUUID,
};