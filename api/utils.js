const fs = require('fs/promises');
const fetch = require('node-fetch');
const { keys, addPh } = require('./messages');

function searchAdvancements(searchString, category, shouldSearchValues = true, maxLength = 25) {
    return new Promise(resolve => {
        fs.readFile('./resources/data/advancements.json', 'utf8')
            .then(advancementJson => {
                const advancementData = JSON.parse(advancementJson);
                const matchingCategory = advancementData.categories[category];

                let matchingTitles = matchingCategory.filter(advancement => advancement.name.toLowerCase().includes(searchString));

                if (matchingTitles.length >= maxLength) matchingTitles.length = maxLength;
                else if(shouldSearchValues) {
                    const matchingKeys = matchingCategory.filter(advancement => advancement.value.includes(searchString));
                    if (matchingKeys.length >= (maxLength - matchingTitles.length)) matchingKeys.length = (maxLength - matchingTitles.length);
                    matchingKeys.forEach(key => matchingTitles.push({ name: key.name, value: key.value }));
                }

                resolve(matchingTitles);
            }).catch(err => {
                console.log(addPh(keys.api.utils.errors.could_not_read_advancements, { "error": err }));
                resolve(false);
            });
    });
}

function searchAllAdvancements(searchString, shouldSearchValues = true, maxLength= 25) {
    return new Promise(resolve => {
        fs.readFile('./resources/data/advancements.json', 'utf8')
            .then(advancementJson => {
                const advancementData = JSON.parse(advancementJson);

                let returnArray = [];
                let matchingTitles = [];

                Object.values(advancementData.categories).forEach(category => {
                    matchingTitles = category.filter(advancement => advancement.name.toLowerCase().includes(searchString));

                    if(shouldSearchValues && matchingTitles.length <= maxLength) {
                        const matchingKeys = category.filter(advancement => advancement.value.includes(searchString) && !matchingTitles.includes(advancement));
                        if (matchingKeys.length >= (maxLength - matchingTitles.length)) matchingKeys.length = (maxLength - matchingTitles.length);
                        matchingKeys.forEach(key => matchingTitles.push({ name: key.name, value: key.value }));
                    }

                    matchingTitles.forEach(key => returnArray.push( { name: key.name, value: key.value }));
                });

                if(returnArray.length >= maxLength) returnArray.length = maxLength;
                resolve(returnArray);
            }).catch(err => {
                console.log(addPh(keys.api.utils.errors.could_not_read_advancements, { "error": err }));
                resolve(false);
            });
    });
}

function isUserConnected(userId) {
    return new Promise(resolve => {
        fs.access(`./userdata/connections/${userId}`)
            .then(() => resolve(true))
            .catch(() => resolve(false));
    });
}

function isGuildConnected(guildId) {
    return new Promise(resolve => {
        fs.access(`./serverdata/connections/${guildId}`)
            .then(() => resolve(true))
            .catch(() => resolve(false));
    });
}

function getUUIDv4(username, userId, message) {
    return new Promise(async resolve => {
        if (!userId) {
            fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
                .then(data => data.json())
                .then(player => {
                    const uuidv4 = player.id.split('');
                    for (let i = 8; i <= 23; i += 5) uuidv4.splice(i, 0, '-');
                    resolve(uuidv4.join(''));
                }).catch(() => {
                    message.respond(keys.api.utils.errors.could_not_get_uuid, { username });
                    resolve(false);
                });
        } else {
            const userData = await getUserData(userId, message);
            resolve(userData?.id);
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
    return serverData?.hash;
}

async function getIp(guildId, message) {
    const serverData = await getServerData(guildId, message);
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