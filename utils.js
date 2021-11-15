const fs = require('fs');
const fetch = require('node-fetch');

module.exports = {
	getUUIDv4: function (user, message) {
        return new Promise(async (resolve, reject) => {
            if(!message.mentions.users.size) {
                try {
                    // @ts-ignore
                    const minecraftId = await fetch(`https://api.mojang.com/users/profiles/minecraft/${user}`)
                        .then(data => data.json())
                        .then(player => player.id);
                    const uuidv4 = minecraftId.split('');
                    for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');

                    resolve(uuidv4.join(''));
                } catch (err) {
                    message.reply('<:Error:849215023264169985> Player [**' + user + '**] does not seem to exist.')
                    console.log('Error getting uuid of ' + user, err);
                    resolve(false);
                }
            } else {
                const taggedUser = message.mentions.users.first();
                fs.readFile('./connections/' + taggedUser.id + '.json', 'utf8', (err, connectionJson) => {
                    if(err) {
                        message.reply(':warning: User never used `/connect`! Instead of pinging someone you can also type in their **minecraft-username**.');
                        console.log('Error reading connectionFile of pinged User from disk');
                        resolve(false);
                    } else {
                        const connectionData = JSON.parse(connectionJson);
                        resolve(connectionData.id);
                    }
                });
            }
        });
	},

    getWorldPath: function (guildId, message) {
        return new Promise((resolve, reject) => {
            fs.readFile(`./ftp/${guildId}.json`, 'utf8', (err, ftpJson) => {
                if(err) {
                    console.log('Error trying to read credentials.');
                    message.reply('<:Error:849215023264169985> Could not read credentials. Please use `/connect` first.');
                    resolve(false);
                } else {
                    const ftpData = JSON.parse(ftpJson);
                    resolve(ftpData.path);
                }
            });
        });
    },

    getUsername: function (userId, message) {
        return new Promise((resolve, reject) => {
            fs.readFile(`./connections/${userId}.json`, 'utf8', (err, connectionJson) => {
                if(err) {
                    message.reply(':warning: User never used `/connect`! Instead of pinging someone you can also type in their **minecraft-username**.');
                    console.log('Error reading connectionFile from disk: ', err);
                    resolve(false);
                } else {
                    const connectionData = JSON.parse(connectionJson);
                    resolve(connectionData.name);
                }
            });
        })
    },

    getHash: function (guildId, message) {
        return new Promise((resolve, reject) => {
            fs.readFile(`./ftp/${guildId}.json`, 'utf8', (err, pluginJson) => {
                if(err) {
                    message.reply('<:Error:849215023264169985> Could not read plugin credentials. Please use `/connect plugin` first.');
                    console.log('Error reading pluginFile from disk: ', err);
                    resolve(false);
                } else {
                    const pluginData = JSON.parse(pluginJson);
                    resolve(pluginData.hash);
                }
            });
        })
    },

    getIp: function (guildId, message) {
        return new Promise((resolve, reject) => {
            fs.readFile(`./ftp/${guildId}.json`, 'utf8', (err, pluginJson) => {
                if(err) {
                    message.reply('<:Error:849215023264169985> Could not read plugin credentials. Please use `/connect plugin` first.');
                    console.log('Error reading pluginFile from disk: ', err);
                    resolve(false);
                } else {
                    const pluginData = JSON.parse(pluginJson);
                    resolve(pluginData.ip);
                }
            });
        })
    }
}