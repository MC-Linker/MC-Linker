const fs = require('fs/promises');
const fetch = require('node-fetch');

module.exports = {
	getUUIDv4: function (username, userId, message) {
        return new Promise(async resolve => {
            if (!userId) {
                fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`)
                    .then(data => data.json())
                    .then(player => {
                        const uuidv4 = player.id.split('');
                        for (let i = 8; i <= 23; i += 5) uuidv4.splice(i, 0, '-');
                        resolve(uuidv4.join(''));
                    }).catch(err => {
                    console.log(`Error getting uuid of ${username}`, err);
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
                }).catch(err => {
                    console.log('Error reading server file');
                    message.reply('<:Error:849215023264169985> Could not read server credentials. Please use `/connect` first.');
                    resolve(false);
                });
        });
    },

    getUserData: async function (userId, message) {
        return new Promise(resolve => {
            fs.readFile(`./connections/users/${userId}.json`, 'utf8')
                .then(userJson => {
                    resolve(JSON.parse(userJson));
                }).catch(err => {
                    console.log('Error reading user file');
                    message.reply(':warning: User never used `/connect account`! Instead of pinging someone you can also type in their **minecraft-username**.');
                    resolve(false);
                });
        });
    }

}