const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');

async function execute(message, args) {
	const username = message.mentions.users.first()?.tag ?? args[0];

	if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
		console.log(`${message.member.user.tag} executed /unban without ban perm in ${message.guild.name}`);
		message.reply(':no_entry: This command can only be used with `Ban member` permission!');
		return;
	} else if(!username) {
		console.log(`${message.member.user.tag} executed /unban without user in ${message.guild.name}`);
		message.reply(':warning: Please specify the player you want to unban.');
		return;
	}

	console.log(`${message.member.user.tag} executed /unban ${username} in ${message.guild.name}`);

	const mcUsername = message.mentions.users.first()?.id ? await utils.getUsername(message.mentions.users.first()?.id, message) : username;
	if(!mcUsername) return;

	const resp = await plugin.execute(`pardon ${mcUsername}`, message);
	if(!resp) return;

	const respEmbed = new Discord.MessageEmbed()
		.setTitle('Unban Player')
		.setColor('BLUE');

	if(resp.startsWith('&c')) respEmbed.setDescription(`:warning: Warning trying to unban player [**${username}**]: ${resp.replace('&c', '')}`);
	else if(resp.startsWith('Could not fetch response message!')) respEmbed.setDescription(`:warning: Successfully executed unban player [**${username}**]\n${resp}`);
	else respEmbed.setDescription(`<:Checkmark:849224496232660992> Successfully unbanned player [**${username}**]`);
	message.reply({ embeds: [respEmbed] });
}

module.exports ={ execute };