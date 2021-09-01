const fs = require('fs');
const rcon = require('../../rcon');
const ftp = require('../../ftp');
const utils = require('../../utils');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'rcon',
    aliases: ['RCON'],
    usage: 'rcon connect <server-ip> <password> <port> **//** rcon execute <command> **//**\nrcon enable',
    example: 'rcon connect 5.83.754.243 T12n53 25567**//**\nrcon execute /seed **//**\nrcon enable',
    description: 'Can only be used by **admins**. Connect this bot with RCON (credentials can be found in the `server.properties` file).\n**OR** Execute minecraft commands on the server (sometimes there will be no response, that doesnt mean it didnt work.) (**WIP**).\n**OR** Enable RCON in the `server.properties` file (Requires ftp). Need help getting the RCON credentials? => Join the [Support Server](https://discord.gg/rX36kZUGNK).',
	data: new SlashCommandBuilder()
			.setName('rcon')
			.setDescription('Various RCON commands.')
			.addSubcommand(subcommand =>
				subcommand.setName('connect')
				.setDescription('Connect this bot with RCON (credentials can be found in the `server.properties` file).')
				.addStringOption(option =>
					option.setName('ip')
					.setDescription('Set the server-ip.')
					.setRequired(true)
				).addStringOption(option =>
					option.setName('password')
					.setDescription('Set the rcon-password.')
					.setRequired(true)
				).addStringOption(option =>
					option.setName('port')
					.setDescription('Set the rcon-port.')
					.setRequired(true)
				)
			).addSubcommand(subcommand =>
				subcommand.setName('execute')
				.setDescription('Execute minecraft commands on the server (sometimes there will be no response)')
				.addStringOption(option =>
					option.setName('command')
					.setDescription('Set the command you want to execute.')
					.setRequired(true)
				)
			).addSubcommand(subcommand =>
				subcommand.setName('enable')
				.setDescription(' Enable RCON in the `server.properties` file (Requires ftp).')
			),
    async execute(message, args) {
		const mode = args[0];
		if(!mode) {
			console.log(message.member.user.tag + ' executed ^rcon without args.');
			message.reply(':warning: Do you want to enable RCON in your server? => `^rcon enable`.\nDo you want to connect the bot with RCON? => `^rcon connect`.\nOr do you want to execute a command with RCON? => `^rcon execute` (**WIP**).');
			return;
		}
		if(mode === 'connect') {
			if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
				message.reply(':no_entry: This command can only be used by admins!');
				console.log(message.member.user.tag + ' executed ^rcon connect without admin in ' + message.guild.name);
				return;
			}

			console.log(message.member.user.tag + ' executed ^rcon ' + args.join(' ') + ' in ' + message.guild.name);
			const ip = args[1];
			const password = args[2];
			const port = args[3]
			if(!password || !port || !ip) {
				console.log(message.member.user.tag + ' executed ^rcon connect without args in ' + message.guild.name);
				message.reply(':warning: Please specify ALL RCON credentials. `^help rcon` for more help.');
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
			if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
				message.reply(':no_entry: This command can only be used by admins!');
				console.log(message.member.user.tag + ' executed ^rcon connect without admin in ' + message.guild.name);
				return;
			}

			args.shift();
			if(!args) {
				console.log(message.member.user.tag + ' executed ^rcon execute without command in ' + message.guild.name);
				message.reply(':warning: Please specify the command you want to execute.')
				return;
			}

			console.log(message.member.user.tag + ' executed ^rcon execute ' + args.join(' ') + ' in ' + message.guild.name);

			let command = args.join(' ');
			if(command.startsWith('/')) command = command.replace('/', '');
			const response = await rcon.executeGetCredentials(command, message);
			if(!response) return;

			message.reply(response);

		} else if (mode === 'enable') {
			if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
				message.reply(':no_entry: This command can only be used by admins!');
				console.log(message.member.user.tag + ' executed ^rcon enable without admin in ' + message.guild.name);
				return;
			}

			console.log(message.member.user.tag + ' executed ^rcon enable in ' + message.guild.name);

			let worldPath = await utils.getWorldPath(message);
			if(worldPath === undefined) return;
			worldPath = worldPath.split('/');
			let path = worldPath[0];
			if(path === '') path = worldPath[1];

			const propFile = await ftp.get(`${path}/server.properties`, `./properties/${message.guild.id}.properties`, message);
			if(propFile === false) return;

			fs.readFile(`./properties/${message.guild.id}.properties`, 'utf8', async (err, propString) => {
				if(err) {
					console.log('Error reading properties file from disk ', err);
					message.reply('<:Error:849215023264169985> Could not read properties file.');
					return;
				}

				const propArr = propString.split('\n');
				const rconEnabled = propArr.find(key => key.startsWith('enable-rcon')).split('=').pop();

				if(rconEnabled === 'false') {
						propString = propString.replace('enable-rcon=false', 'enable-rcon=true');

						fs.writeFile(`./properties/${message.guild.id}.properties`, propString, 'utf8', async (err) => {
							if(err) {
								console.log('Error writing properties file.', err);
								message.reply('<:Error:849215023264169985> Error trying to enable RCON.');
								return;
							}
							console.log('Successfully wrote properties file.');
							await ftp.put(`./properties/${message.guild.id}.properties`, `${path}/server.properties`, message)

							message.reply('<:Checkmark:849224496232660992> Enabled RCON. Please **restart the server** to complete the activation.');
						});
				} else if (rconEnabled === 'true') {
					console.log('rcon is already enabled.');
					message.reply(':warning: RCON is already enabled. Please restart the server if you still cannot connect.');
				}
			})

		} else {
			console.log(message.member.user.tag + ' executed ^rcon with incorrect arg: ' + mode + ' in ' + message.guild.name);
			message.reply(':warning: This argument [**' + mode + '**] does not exist.');
			return;
		}
	}
}