const utils = require('../../utils');
const ftp = require('../../ftp');
const fs = require('fs');
const rcon = require('../../rcon');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'unban',
    aliases: ['pardon'],
    usage: 'unban <mention/username>',
    example: 'unban @Lianecx **//** unban MrNotCheating',
    description: 'Unban a banned player from the **minecraft-server**. Can only be used with `Ban member` permissions.',
	data: new SlashCommandBuilder()
			.setName('unban')
			.setDescription('Unban a banned player from the minecraft-server.')
			.addUserOption(option =>
				option.setName('user')
				.setDescription('Set the user you want to unban.')
				.setRequired(true)
			),
    async execute(message, args) {
		if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
			message.reply(':no_entry: ' + "This command can only be used with `Ban member` permission!");
            console.log(message.member.user.tag + ' executed ^unban without banperm in ' + message.guild.name);
            return;
		}

		if(!args[0]) {
            console.log(message.member.user.tag + ' executed ^unban without user in ' + message.guild.name);
            message.reply(':warning: Please specify the player you want to unban.');
            return;
        }

		let taggedUser = args.shift();
		let taggedName;
		let userName;
		if(!message.mentions.users.size) {
			userName = taggedUser;
            taggedName = taggedUser;
        } else {
			userName = await utils.getUsername(message.mentions.users.first().id, message);
			if(!userName) return;
            taggedName = message.mentions.users.first().tag;
        }

		console.log(message.member.user.tag + ' executed ^unban with taggedUser: ' + taggedName + ' in ' + message.guild.name);

		fs.readFile(`./rcon/${message.guild.id}.json`, 'utf8', async (err, rconJson) => {
			if (err) {
				console.log('Could not find rconFile on Disk, creating one...');
				message.reply(':warning: Could not read rcon credentials, attempting to create some. (If this errors, do `^rcon connect` or `^ftp connect`)');

				const uuidv4 = await utils.getUUIDv4(userName, message);
				if(!uuidv4) return;

				const worldPath = await utils.getWorldPath(message);
				if(!worldPath) return;
				const path = worldPath.split('/').slice(0, -1).join('/');

				const propFile = await ftp.get(`${path}/server.properties`, `./properties/${message.guild.id}.properties`, message);
				if(!propFile) return;

				fs.readFile(`./properties/${message.guild.id}.properties`, 'utf8', async (err, propString) => {
					if(err) {
						console.log('Error reading properties file from disk ', err);
						message.reply('<:Error:849215023264169985> Could not read properties file.');
						return;
					}

					const propArr = propString.split('\n');
					const rconEnabled = propArr.find(key => key.startsWith('enable-rcon')).split('=').pop();

					if(rconEnabled === 'false') {
						const confirmRow = new Discord.MessageActionRow()
							.addComponents([
								new Discord.MessageButton()
									.setCustomId('rcon_disable')
									.setStyle('PRIMARY')
									.setLabel('Keep RCon disabled.')
									.setEmoji('<:Error:849215023264169985>'),
								new Discord.MessageButton()
									.setCustomId('rcon_enable')
									.setStyle('SUCCESS')
									.setLabel('Enable Rcon.')
									.setEmoji('<:Checkmark:849224496232660992>')
							]);
						const disabledRow = new Discord.MessageActionRow()
							.addComponents([
								new Discord.MessageButton()
									.setCustomId('rcon_disable')
									.setStyle('PRIMARY')
									.setLabel('Keep RCon disabled.')
									.setEmoji('<:Error:849215023264169985>')
									.setDisabled(true),
								new Discord.MessageButton()
									.setCustomId('rcon_enable')
									.setStyle('SUCCESS')
									.setLabel('Enable RCon.')
									.setEmoji('<:Checkmark:849224496232660992>')
									.setDisabled(true)
							]);

						console.log('RCON disabled, asking user for enabling...');
						const confirmMsg = await message.reply({ content: 'RCON is disabled, do you want the bot to enable it? (You have 20 seconds to react)', components: [confirmRow] });
						const collector = confirmMsg.createMessageComponentCollector({ componentType: 'BUTTON', time: 20000 });

						collector.on('collect', async button => {
							if(button.customId === 'rcon_enable' && button.member.user.id === message.member.user.id) {
								button.deferUpdate();
								console.log('Answer: enable RCon');

								// @ts-ignore
								propString = propString.replace('enable-rcon=false', 'enable-rcon=true');

								// @ts-ignore
								fs.writeFile(`./properties/${message.guild.id}.properties`, propString, 'utf-8', err => {
									console.log('Error writing properties file.', err);
									message.reply('<:Error:849215023264169985> Error trying to enable RCON.');
									return;
								});

								console.log('Successfully wrote properties file.');

								const propFile = await ftp.put(`./properties/${message.guild.id}.properties`, `${path}/server.properties`, message)
								if(!propFile) return;

								message.reply('<:Checkmark:849224496232660992> Enabled RCON. Please **restart the server** and try this command again.');
							} else if (button.customId === 'rcon_disable' && button.member.user.id === message.member.user.id) {
								button.deferUpdate();
								console.log('Answer: keep RCon disabled');
								message.reply('We deleted the possibilty to unban and ban someone with ftp since it required a restart of the minecraft-server. You will have to enable RCon (`/rcon enable`).');
							}
						});

						collector.on('end', collected => {
							if(!collected.size) message.editReply({ content: 'RCON is disabled, do you want the bot to enable it? (Time ran out.)', components: [disabledRow] });
						});
					} else if (rconEnabled === 'true') {
						const password = propArr.find(key => key.startsWith('rcon.password')).split('=').pop();
						const port = propArr.find(key => key.startsWith('rcon.port')).split('=').pop();
						const ip = propArr.find(key => key.startsWith('server-ip')).split('=').pop();

                        if(ip === '' || port === '' || password === '') {
                            console.log('RCON credentials are not specified in server.properties.');
                            message.reply(':warning: Please use `^rcon connect` OR define all RCON credentials in the `server.properties` file.');
                            return;
                        }

						const rconString = {
							"password": password,
							"port": port,
							"ip": ip
						}
						const rconJson = JSON.stringify(rconString, null, 2);

						fs.writeFile(`./rcon/${message.guild.id}.json`, rconJson, 'utf8', (err) => {
							if(err) {
								console.log('Error writing rconFile.', err);
								message.reply('<:Error:849215023264169985> Error trying to connect to the RCON.');
								return;
							}
							console.log('Successfully wrote rconFile.');
                            message.reply('<:Checkmark:849224496232660992> Created RCON credentials from the `server.properties` file.')
						});

						const response = await rcon.execute(ip, port, password, `pardon ${userName}`, message);
						if(!response) return;

						const respEmbed = new Discord.MessageEmbed().setTitle('Unban player').setColor('BLUE').setDescription(response);
						message.reply({ embeds: [respEmbed] });
					}
				})
				return;
			}

			const rconData = JSON.parse(rconJson);
			const password = rconData.password;
			const port = rconData.port;
			const ip = rconData.ip;

			const response = await rcon.execute(ip, port, password, `pardon ${userName}`, message);
			if(!response) return;

			const respEmbed = new Discord.MessageEmbed().setTitle('Unban player').setColor('BLUE').setDescription(response);
			message.reply({ embeds: [respEmbed] });
		})
	}
}