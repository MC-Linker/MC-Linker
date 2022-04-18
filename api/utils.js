const fs = require('fs/promises');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const { keys, addPh, ph } = require('./messages');

function searchAdvancements(searchString, category, shouldSearchValues = true, maxLength = 25) {
    return new Promise(resolve => {
        fs.readFile('./resources/data/advancements.json', 'utf8')
            .then(advancementJson => {
                const advancementData = JSON.parse(advancementJson);
                const matchingCategory = advancementData.categories[category];

                let matchingTitles = matchingCategory.filter(advancement => {
                    //Filter for matching name and (if shouldSearchValues === true) for matching value
                    return advancement.name.toLowerCase().includes(searchString) || (!shouldSearchValues || advancement.value.toLowerCase().includes(searchString));
                });

                //Add category field
                matchingTitles.map(title => title.category = matchingCategory);

                matchingTitles = [...new Set(matchingTitles)]; //Remove duplicates
                if(matchingTitles.length >= maxLength) matchingTitles.length = maxLength;
                resolve(matchingTitles);
            }).catch(err => {
                console.log(addPh(keys.api.utils.errors.could_not_read_advancements.console, ph.fromError(err)));
                resolve([]);
            });
    });
}

function searchAllAdvancements(searchString, shouldSearchValues = true, maxLength= 25) {
    return new Promise(resolve => {
        fs.readFile('./resources/data/advancements.json', 'utf8')
            .then(advancementJson => {
                const advancementData = JSON.parse(advancementJson);

                let matchingTitles = [];
                let matchingKeys = [];

                Object.values(advancementData.categories).forEach(category => {
                    matchingKeys = category.filter(advancement => {
                        //Filter for matching name and (if shouldSearchValues === true) for matching value
                        return advancement.name.toLowerCase().includes(searchString) || (!shouldSearchValues || advancement.value.toLowerCase().includes(searchString));
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
            fetch(`https://api.mojang.com/users/profiles/minecraft/${user}`)
                .then(data => data.json())
                .then(player => {
                    const uuidv4 = player.id.split('');
                    for (let i = 8; i <= 23; i += 5) uuidv4.splice(i, 0, '-');
                    resolve(uuidv4.join(''));
                }).catch(() => {
                    message.respond(keys.api.utils.errors.could_not_get_uuid, { "username": user });
                    resolve(false);
                });
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
        fs.readFile(`./serverdata/connections/${guildId}/connection.json`, 'utf8')
            .then(serverJson => {
                resolve(JSON.parse(serverJson));
            }).catch(() => {
                message.respond(keys.api.utils.errors.could_not_read_server_file);
                resolve(false);
            });
    });
}

function getUserData(userId, message) {
    return new Promise(resolve => {
        fs.readFile(`./userdata/connections/${userId}/connection.json`, 'utf8')
            .then(userJson => {
                resolve(JSON.parse(userJson));
            }).catch(() => {
                message.respond(keys.api.utils.errors.could_not_read_user_file);
                resolve(false);
            });
    });
}

module.exports = { searchAllAdvancements, searchAdvancements, isGuildConnected, isUserConnected, getUserData, getServerData, getUsername, getIp, getProtocol, getHash, getWorldPath, getVersion, getUUIDv4 };