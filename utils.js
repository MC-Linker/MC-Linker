module.exports = {
	getUUIDv4: async function (user, message) {
		const fs = require('fs');
        const fetch = require('node-fetch');
		
        if(!message.mentions.users.size) {
            const taggedName = (user);
            // @ts-ignore
            try {
                // @ts-ignore
                const minecraftId = await fetch(`https://api.mojang.com/users/profiles/minecraft/${taggedName}`)
                    .then(data => data.json())
                    .then(player => player.id);
                const uuidv4 = minecraftId.split('');
                for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');

                return uuidv4.join('');
            } catch (err) {
                message.reply('<:Error:849215023264169985> Player [**' + taggedName + '**] does not seem to exist.')
                console.log('Error getting uuid of ' + taggedName, err);
                return;
            }
        } else {
            const taggedUser = message.mentions.users.first();
            try {
                const connectionJson = fs.readFileSync('./connections/' + taggedUser.id + '.json');
                // @ts-ignore
                const connectionData = await JSON.parse(connectionJson);
                
                return connectionData.id;
            } catch (err) {
                message.reply(":warning: User never used `^connect`! Instead of pinging someone you can also type in their **minecraft-username**.");
                console.log('Error reading connectionFile of pinged User from disk: ', err);
                return;
            }
        }
	},

    getWorldPath: async function (message) {
        const fs = require('fs');

        try {
            const ftpJson = fs.readFileSync('./ftp/' + message.guild.id + '.json');
            // @ts-ignore
            const ftpData = JSON.parse(ftpJson);
            return ftpData.path;
        } catch (err) {
            console.log('Error trying to read ftpFile.');
            message.reply('<:Error:849215023264169985> Could not read ftp Credentials.');
            return;
        }
    },
    
    getUserName: async function (userId, message) {
        const fs = require('fs');

        try {
            const connectionJson = fs.readFileSync(`./connections/${userId}.json`);
            // @ts-ignore
            const connectionData = await JSON.parse(connectionJson);
            
            return connectionData.name;
        } catch (err) {
            message.reply(":warning: User never used `^connect`! Instead of pinging someone you can also type in their **minecraft-username**.");
            console.log('Error reading connectionFile of pinged User from disk: ', err);
            return;
        }
    }
}