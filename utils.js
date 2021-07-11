module.exports = {
	getUUIDv4: async function (user, message) {
		const fs = require('fs');
		
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

                return uuidv4.join("");
            } catch (err) {
                message.reply('<:Error:849215023264169985> Player [**' + taggedName + '**] does not seem to exist.')
                console.log('Error getting uuid of ' + taggedName, err)
                return;
            }
        } else {
            const taggedName = message.mentions.users.first();
            try {
                const connectionJson = fs.readFileSync('./connections/' + taggedName.id + '.json');
                // @ts-ignore
                const connectionData = await JSON.parse(connectionJson);
				
                return connectionData.id;
            } catch (err) {
                message.reply(":warning: User isn't connected");
                console.log('Error reading connectionFile from disk: ', err);
                return;
            }
        }
	}

	
}