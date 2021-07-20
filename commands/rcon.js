module.exports = {
    name: 'rcon',
    aliases: ['RCON'],
    usage: 'rcon connect <server IP> <password> <port> **//** rcon execute <command> (**WIP**)',
    example: 'rcon connect 5.83.754.243 T12n53 10085**//** rcon execute /seed (**WIP**)',
    description: 'Connect this bot with RCON (credentials can be found in the `server.properties` file) **or** execute commands on the server with RCON (as of right now, both can only be used by **admins**). Need help getting the RCON credentials? => Do `^ftp` **or** join the [Support Server](https://discord.gg/rX36kZUGNK).',
    execute(message, args) {
		const fs = require('fs');

		const mode = args[0];
		if(mode === 'connect') {
			if (!message.member.hasPermission("ADMINISTRATOR")) {
				message.reply(':no-entry: This command can only be used by admins!');
				console.log(message.member.user.tag + ' executed ^rcon connect without admin in ' + message.guild.name);
				return;
			}

			console.log(message.member.user.tag + ' executed ^rcon ' + args.join(' ') + ' in ' + message.guild.name);
			const ip = args[1];
			const password = args[2];
			const port = args[3]
			if(!password || !port || !ip) {
				console.log(message.member.user.tag + ' executed ^rcon connect without args in ' + message.guild.name);
				message.reply(':warning: Please specify the RCON credentials. `^help rcon` for more help.');
				return;
			}
			
			const rconString = {
				"password": password,
				"port": port,
				"ip": ip
			}
			const rconJson = JSON.stringify(rconString, null, 2);
			fs.writeFile(`./rcon/${message.guild.id}.json`, rconJson, (err) => {
				if(err) {
					console.log('Error writing rconFile.', err);
					message.reply('<:Error:849215023264169985> Error trying to connect to the RCON.');
					return;
				}
				console.log('Successfully wrote rconFile.');
				message.reply('<:Checkmark:849224496232660992> Successfully connected to the RCON.');
			})

		} else if (mode === 'execute') {
			if (!message.member.hasPermission("ADMINISTRATOR")) {
				message.reply(':no-entry: This command can (currently) only be used by admins!');
				console.log(message.member.user.tag + ' executed ^rcon connect without amdin in ' + message.guild.name);
				return;
			}

			console.log(message.member.user.tag + ' executed ^rcon execute in ' + message.guild.name);
			message.reply(':warning: `^rcon execute` is currenty Work in Progress.');
			return;

		} else {
			console.log(message.member.user.tag + ' executed ^rcon with incorrect arg: ' + mode + ' in ' + message.guild.name);
			message.reply(':warning: This argument [**' + mode + '**] does not exist.');
			return;
		}
	}
}