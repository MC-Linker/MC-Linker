const fs = require('fs-extra');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const mcData = require('minecraft-data')('1.19');
const { keys, addPh, ph, defaultMessage } = require('./messages');

function searchAdvancements(searchString, category, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    return new Promise(resolve => {
        fs.readJson('./resources/data/advancements.json', 'utf8')
            .then(advancementData => {
                const matchingCategory = advancementData.categories[category];

                let matchingTitles = matchingCategory.filter(advancement => {
                    //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value
                    let match;
                    if(shouldSearchNames) match = advancement.name.toLowerCase().includes(searchString);
                    if(shouldSearchValues || !match) match = advancement.value.toLowerCase().includes(searchString);

                    return match;
                });

                //Add category field
                const categoryKey = Object.keys(advancementData.categories).find(key => advancementData.categories[key] === matchingCategory);
                matchingTitles.map(title => title.category = categoryKey);

                matchingTitles = [...new Set(matchingTitles)]; //Remove duplicates
                if(matchingTitles.length >= maxLength) matchingTitles.length = maxLength;
                resolve(matchingTitles);
            }).catch(err => {
                console.log(addPh(keys.api.utils.errors.could_not_read_advancements.console, ph.fromError(err)));
                resolve([]);
            });
    });
}

function searchAllAdvancements(searchString, shouldSearchNames = true, shouldSearchValues = true, maxLength= 25) {
    return new Promise(resolve => {
        fs.readJson('./resources/data/advancements.json', 'utf8')
            .then(advancementData => {
                let matchingTitles = [];
                let matchingKeys = [];

                Object.values(advancementData.categories).forEach(category => {
                    matchingKeys = category.filter(advancement => {
                        //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value or category.value
                        let match;
                        if(shouldSearchNames) match = advancement.name.toLowerCase().includes(searchString);
                        if(shouldSearchValues || !match) match = advancement.value.toLowerCase().includes(searchString);

                        return match;
                    });

                    //Add category field
                    const categoryKey = Object.keys(advancementData.categories).find(key => advancementData.categories[key] === category);
                    matchingKeys.map(key => key.category = categoryKey);

                    matchingKeys.forEach(key => matchingTitles.push(key));
                });

                matchingTitles = [...new Set(matchingTitles)]; //Remove duplicates
                if(matchingTitles.length >= maxLength) matchingTitles.length = maxLength;
                resolve(matchingTitles);
            }).catch(err => {
                console.log(addPh(keys.api.utils.errors.could_not_read_advancements, ph.fromError(err)));
                resolve([]);
            });
    });
}

function searchStats(searchString, category, shouldSearchNames = true, shouldSearchValues = true, maxLength = 25) {
    return new Promise(resolve => {
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
                if(!match && shouldSearchValues) match = data.name.includes(searchString.toLowerCase());

                return match;
            }).map(data => {
                return {
                    name: data.displayName,
                    value: data.name,
                };
            }); //Only include displayName and name

            matchingStats = [...new Set(matchingStats)]; //Remove duplicates
            if(matchingStats.length >= maxLength) matchingStats.length = maxLength; //Reduce length

            resolve(matchingStats);
        } else if(category === 'custom') {
            fs.readJson('./resources/data/stats_custom.json', (err, statData) => {
                if(err) return resolve([]);

                matchingStats = statData.stats.filter(stat => {
                    //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value or category.value
                    let match = false;
                    if(shouldSearchNames) match = stat.name.toLowerCase().includes(searchString.toLowerCase());
                    if(!match && shouldSearchValues) match = stat.value.includes(searchString.toLowerCase());

                    return match;
                });
                matchingStats = [...new Set(matchingStats)]; //Remove duplicates
                if(matchingStats.length >= maxLength) matchingStats.length = maxLength; //Reduce length

                resolve(matchingStats);
            });
        } else return resolve([]);
    });
}

function isUserConnected(userId) {
    return new Promise(resolve => {
        fs.access(`./userdata/connections/${userId}/connection.json`)
            .then(() => resolve(true))
            .catch(() => resolve(false));
    });
}

function isGuildConnected(guildId) {
    return new Promise(resolve => {
        fs.access(`./serverdata/connections/${guildId}/connection.json`)
            .then(() => resolve(true))
            .catch(() => resolve(false));
    });
}

function getUUIDv4(user, message = defaultMessage) {
    return new Promise(async resolve => {
        if(user instanceof Discord.User) {
            const userData = await getUserData(user.id, message);
            resolve(userData?.id);
        } else {
            try {
                let data = await fetch(`https://api.mojang.com/users/profiles/minecraft/${user}`);
                data = await data.json();

                const uuidv4 = data.id.split('');
                for (let i = 8; i <= 23; i += 5) uuidv4.splice(i, 0, '-');
                resolve(uuidv4.join(''));
            } catch(err) {
                message.respond(keys.api.utils.errors.could_not_get_uuid, { "username": user });
                resolve(false);
            }
        }
    });
}

async function getUsername(userId, message = defaultMessage) {
    const userData = await getUserData(userId, message);
    return userData?.name;
}

async function getWorldPath(guildId, message = defaultMessage) {
    const serverData = await getServerData(guildId, message);
    return serverData?.path;
}

async function getVersion(guildId, message = defaultMessage) {
    const serverData = await getServerData(guildId, message);
    return serverData?.version;
}

async function getProtocol(guildId, message = defaultMessage) {
    const serverData = await getServerData(guildId, message);
    return serverData?.protocol;
}

async function getHash(guildId, message = defaultMessage) {
    const serverData = await getServerData(guildId, message);
    //If connected but not with plugin
    if(serverData && serverData.protocol !== 'plugin') message.respond(keys.api.utils.errors.not_connected_with_plugin);

    return serverData?.hash;
}

async function getIp(guildId, message = defaultMessage) {
    const serverData = await getServerData(guildId, message);
    //If connected but not with plugin
    if(serverData && serverData?.protocol !== 'plugin') message.respond(keys.api.utils.errors.not_connected_with_plugin);

    return serverData?.ip;
}

function getServerData(guildId, message = defaultMessage) {
    return new Promise(resolve => {
        fs.readJson(`./serverdata/connections/${guildId}/connection.json`, 'utf8')
            .then(serverJson => resolve(serverJson))
            .catch(() => {
                message.respond(keys.api.utils.errors.could_not_read_server_file);
                resolve(false);
            });
    });
}

function getUserData(userId, message = defaultMessage) {
    return new Promise(resolve => {
        fs.readJson(`./userdata/connections/${userId}/connection.json`, 'utf8')
            .then(userJson => resolve(userJson))
            .catch(() => {
                message.respond(keys.api.utils.errors.could_not_read_user_file);
                resolve(false);
            });
    });
}

module.exports = { searchAllAdvancements, searchAdvancements, searchStats, isGuildConnected, isUserConnected, getUserData, getServerData, getUsername, getIp, getProtocol, getHash, getWorldPath, getVersion, getUUIDv4 };