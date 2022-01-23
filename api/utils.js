const fs = require('fs/promises');
const fetch = require('node-fetch');

module.exports = {
    searchAdvancements(searchString, category, shouldSearchValues = true, maxLength = 25) {
        return new Promise(resolve => {
            fs.readFile('./src/advancements.json', 'utf8')
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
                    console.log('Error reading advancements file', err);
                    resolve(false);
                });
        });
    },
    searchAllAdvancements(searchString, shouldSearchValues = true, maxLength= 25) {
        return new Promise(resolve => {
            fs.readFile('./src/advancements.json', 'utf8')
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
                    console.log('Error reading advancements file', err);
                    resolve(false);
                });
        });
    },

	getUUIDv4: function (username, userId, message) {
        return new Promise(async resolve => {
            if (!userId) {
                fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
                    .then(data => data.json())
                    .then(player => {
                        const uuidv4 = player.id.split('');
                        for (let i = 8; i <= 23; i += 5) uuidv4.splice(i, 0, '-');
                        resolve(uuidv4.join(''));
                    }).catch(() => {
                    console.log(`Error getting uuid of ${username}`);
                    message.reply(`<:Error:849215023264169985>  [**${username}**] is not a valid minecraft java edition account name.`);
                    resolve(false);
                });
            } else {
                const userData = await this.getUserData(userId, message);
                resolve(userData?.id);
            }
        });

    },

    getUsername: async function (userId, message) {
        const userData = await this.getUserData(userId, message);
        return userData?.name;
    },

    getWorldPath: async function (guildId, message) {
        const serverData = await this.getServerData(guildId, message);
        return serverData?.path;
    },

    getVersion: async function (guildId, message) {
        const serverData = await this.getServerData(guildId, message);
        return serverData?.version.split('.').pop();
    },

    getProtocol: async function (guildId, message) {
        const serverData = await this.getServerData(guildId, message);
        return serverData?.protocol;
    },

    getHash: async function (guildId, message) {
        const serverData = await this.getServerData(guildId, message);
        if (serverData?.protocol === 'plugin') return serverData?.hash;
        else return false;
    },

    getIp: async function (guildId, message) {
        const serverData = await this.getServerData(guildId, message);
        if (serverData?.protocol === 'plugin') return serverData?.ip;
        else return false;
    },

    getServerData: function (guildId, message) {
        return new Promise(resolve => {
            fs.readFile(`./connections/servers/${guildId}.json`, 'utf8')
                .then(serverJson => {
                    resolve(JSON.parse(serverJson));
                }).catch(() => {
                    console.log('Error reading server file');
                    message.reply('<:Error:849215023264169985> Could not read server credentials. Please use `/connect plugin` or `/connect ftp` first.');
                    resolve(false);
                });
        });
    },

    getUserData: async function (userId, message) {
        return new Promise(resolve => {
            fs.readFile(`./connections/users/${userId}.json`, 'utf8')
                .then(userJson => {
                    resolve(JSON.parse(userJson));
                }).catch(() => {
                    console.log('Error reading user file');
                    message.reply(':warning: User never used `/connect account`! Instead of pinging someone you can also type in their **minecraft-username**.');
                    resolve(false);
                });
        });
    }
}