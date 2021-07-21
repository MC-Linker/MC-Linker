module.exports = {
	execute: async function (ip, port, pass, command, message) {
		const rcon = require('rcon');
		const Discord = require('discord.js');

		const rconCLient = new rcon(ip, port, pass, {
			tcp: true,
			challenge: false
		});

		let respEmbed;
		if (command.startsWith('ban')) {
			respEmbed = new Discord.MessageEmbed().setTitle('Ban player').setColor('ORANGE');
		} else if (command.startsWith('pardon')) {
			respEmbed = new Discord.MessageEmbed().setTitle('Unban player').setColor('BLUE');
		}
		
		rconCLient.connect();

		// @ts-ignore
		rconCLient.on('auth', () => {
			rconCLient.send(command);
			rconCLient.disconnect();

		}).on('response', (response) => {
			console.log(response);
			if(respEmbed !== undefined) {respEmbed.setDescription(response); message.channel.send(respEmbed);}
			else message.reply('<:Checkmark:849224496232660992> ' + response)

		}).on('error', (err) => {
			console.log('Error trying to execute Command: ' + command , err);
			message.reply('<:Error:849215023264169985> Error trying to execute command. Please check if rcon is enabled in the `server.properties` file.');
		});

	}
}