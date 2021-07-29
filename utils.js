module.exports = {
	getUUIDv4: function (user, message) {
        return new Promise(async (resolve, reject) => {
            const fs = require('fs');
            const fetch = require('node-fetch');
            
            if(!message.mentions.users.size) {
                const taggedName = user;
                try {
                    const minecraftId = await fetch(`https://api.mojang.com/users/profiles/minecraft/${taggedName}`)
                        .then(data => data.json())
                        .then(player => player.id);
                    const uuidv4 = minecraftId.split('');
                    for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');
    
                    resolve(uuidv4.join(''));
                } catch (err) {
                    message.reply('<:Error:849215023264169985> Player [**' + taggedName + '**] does not seem to exist.')
                    console.log('Error getting uuid of ' + taggedName, err);
                    resolve(undefined);
                }
            } else {
                const taggedUser = message.mentions.users.first();
                fs.readFile('./connections/' + taggedUser.id + '.json', 'utf8', (err, connectionJson) => {
                    if(err) {
                        message.reply(":warning: User never used `^connect`! Instead of pinging someone you can also type in their **minecraft-username**.");
                        console.log('Error reading connectionFile of pinged User from disk: ', err);
                        resolve(undefined);
                    } else {
                        const connectionData = JSON.parse(connectionJson);                  
                        resolve(connectionData.id);
                    }  
                });
            }
        });
	},

    getWorldPath: function (message) {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            fs.readFile('./ftp/' + message.guild.id + '.json', 'utf8', (err, ftpJson) => {
                if(err) {
                    console.log('Error trying to read ftpFile.');
                    message.reply('<:Error:849215023264169985> Could not read ftp Credentials.');
                    resolve(undefined);
                } else {
                    const ftpData = JSON.parse(ftpJson);
                    resolve(ftpData.path);
                }
            });
        });
    },
    
    getUserName: function (userId, message) {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            fs.readFileSync(`./connections/${userId}.json`, 'utf8', (err, connectionJson) => {
                if(err) {
                    message.reply(":warning: User never used `^connect`! Instead of pinging someone you can also type in their **minecraft-username**.");
                    console.log('Error reading connectionFile of pinged User from disk: ', err);
                    rresolve(undefined);
                } else {
                    const connectionData = JSON.parse(connectionJson);
                    resolve(connectionData.name);
                }
            });
        })
    }
}