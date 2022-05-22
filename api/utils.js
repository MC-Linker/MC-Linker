const fs = require('fs-extra');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const { keys, addPh, ph } = require('./messages');

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
        if(category !== 'custom') {
            fs.readdir(`./resources/images/minecraft/${category}`, (err, images) => {
                if(err) return resolve(false);

                const matchingImages = images.filter(image => image.includes(searchString.replaceAll(' ', '_')));
                if(matchingImages.length >= 25) matchingImages.length = 25;

                const respondArray = [];
                matchingImages.forEach(image => {
                    let formattedImage = image.replaceAll('.png', '');
                    formattedImage = formattedImage.split('_').map(word => word.cap()).join(' ');

                    respondArray.push({
                        name: formattedImage,
                        value: image.replaceAll('.png', ''),
                    });
                });

                resolve(respondArray);
            });
        } else {
            fs.readJson('./resources/data/stats_custom.json', (err, statData) => {
                if(err) return resolve([]);

                let matchingStats;

                matchingStats = Object.values(statData.stats).filter(stat => {
                    //Filter (if shouldSearchNames === true) for matching name and (if shouldSearchValues === true) for matching value or category.value
                    let match;
                    if(shouldSearchNames) match = stat.name.toLowerCase().includes(searchString);
                    if(shouldSearchValues || !match) match = stat.value.toLowerCase().includes(searchString);

                    return match;
                });

                matchingStats = [...new Set(matchingStats)]; //Remove duplicates
                if(matchingStats.length >= maxLength) matchingStats.length = maxLength;

                resolve(matchingStats);
            });
        }
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

function getUUIDv4(user, message) {
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

async function getUsername(userId, message) {
    const userData = await getUserData(userId, message);
    return userData?.name;
}

async function getWorldPath(guildId, message) {
    const serverData = await getServerData(guildId, message);
    return serverData?.path;
}

async function getVersion(guildId, message) {
    const serverData = await getServerData(guildId, message);
    return serverData?.version.split('.').pop();
}

async function getProtocol(guildId, message) {
    const serverData = await getServerData(guildId, message);
    return serverData?.protocol;
}

async function getHash(guildId, message) {
    const serverData = await getServerData(guildId, message);
    //If connected but not with plugin
    if(serverData && serverData.protocol !== 'plugin') message.respond(keys.api.utils.errors.not_connected_with_plugin);

    return serverData?.hash;
}

async function getIp(guildId, message) {
    const serverData = await getServerData(guildId, message);
    //If connected but not with plugin
    if(serverData && serverData?.protocol !== 'plugin') message.respond(keys.api.utils.errors.not_connected_with_plugin);

    return serverData?.ip;
}

function getServerData(guildId, message) {
    return new Promise(resolve => {
        fs.readJson(`./serverdata/connections/${guildId}/connection.json`, 'utf8')
            .then(serverJson => resolve(serverJson))
            .catch(() => {
                message.respond(keys.api.utils.errors.could_not_read_server_file);
                resolve(false);
            });
    });
}

function getUserData(userId, message) {
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