module.exports = {
    name: 'ban',
    aliases: ['banplayer', 'banuser'],
    usage: 'ban <mention/username>',
    example: 'ban @Lianecx **//** ban cheaterGuy',
    description: 'Ban a player from the **minecraft server**. Can only be used with `Ban member` permission!',
    async execute(message, args) {
		const utils = require('../utils');
		const ftp = require('../ftpConnect');
		const fs = require('fs');
		const taggedUser = args.shift();
		if(!taggedUser) {
            console.log(message.member.user.tag + ' executed ^ban without user in ' + message.guild.name);
            message.reply('Please specify the player you want to ban.');
            return;
        }

		let reason = '';
		if(!args[0]) reason = 'Banned by an operator.';
		else reason = args.join(' ');

		let taggedName;
		let userName;
		if(!message.mentions.users.size) {
			userName = taggedUser;
            taggedName = taggedUser;
        } else {
			userName = await utils.getUserName(message.mentions.users.first().id, message);
			if(userName === undefined) return;
            taggedName = message.mentions.users.first().tag;
        }
		console.log(message.member.user.tag + ' executed ^ban with taggedUser: ' + taggedName + ' in ' + message.guild.name)

		if (!message.member.hasPermission("BAN_MEMBERS")) {
			message.reply(':warning: ' + "This command can only be used with `Ban member` permission!");
            console.log(message.member.user.tag + ' executed ^ban without banperm in ' + message.guild.name);
            return;
		}
		const uuidv4 = await utils.getUUIDv4(taggedUser, message);
        if(uuidv4 === undefined) return;

		let worldPath = await utils.getWorldPath(message);
		if(worldPath === undefined) return;

		worldPath = worldPath.split('/');
		let path = worldPath[0];
		if(path === '') path = worldPath[1];
		await ftp.get(`${path}/banned-players.json`, `./bans/${message.guild.id}.json`, message);

		const banReplace = {
			"uuid": uuidv4,
			"name": userName,
			"created": new Date(),
			"source": "Smp_Minecraft_Bot",
			"expires": "forever",
			"reason": reason
		}

		fs.readFile(`./bans/${message.guild.id}.json`, 'utf8', (err, banJson) => {
			if (err) {
				console.log('Error reading ban file from disk ', err);
				message.reply('<:Error:849215023264169985> ' + 'Could not read ban file.');
                return;
			}
			let banData = JSON.parse(banJson);
			for(let i = 0; i<banData.length; i++) {
				if(banData[i].uuid === uuidv4) {
					console.log('Player is already banned.');
					message.reply(':warning: Player [**' + taggedName + '**] is already banned.');
					return;
				}
			}
			banData.splice(0, 0, banReplace);

			const banString = JSON.stringify(banData, null, 2);
			fs.writeFile(`./bans/${message.guild.id}.json`, banString, async (err) => {
				if(err) {
					console.log('Error writing banFile');
					message.reply('<:Error:849215023264169985> Error trying to ban player.');
					return;
				}
				await ftp.put(`./bans/${message.guild.id}.json`, `${path}/banned-players.json`, message);

				console.log('Succesfully wrote and put banFile on server.');
				message.reply('<:Checkmark:849224496232660992> Succesfully banned player [**' + taggedName + '**] from the minecraft server.');	
			})
		})
	}
}