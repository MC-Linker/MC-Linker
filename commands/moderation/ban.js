const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'ban',
    aliases: ['banplayer'],
    usage: 'ban <mention/username>',
    example: '/ban @Lianecx **//** /ban cheaterGuy',
    description: 'Ban a player from the **minecraft server**. Can only be used with `Ban member` permission!',
	data: new SlashCommandBuilder()
			.setName('ban')
			.setDescription('Ban a player from the minecraft server.')
			.addUserOption(option =>
				option.setName('user')
				.setDescription('Set the user you want to ban.')
				.setRequired(true)
			).addStringOption(option =>
				option.setName('reason')
				.setDescription('Set a reason for the ban.')
				.setRequired(false)
			),
    async execute(message, args) {
		const username = message.mentions.users.first()?.tag ?? args[0];
		args.shift();
		let reason = args[0] ? args.join(' ') : 'Banned by an operator.';

		if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
			console.log(`${message.member.user.tag} executed /ban without ban permission in ${message.guild.name}`);
			message.reply(':no_entry: This command can only be used with `Ban member` permission!');
            return;
		} else if(!username) {
            console.log(`${message.member.user.tag} executed /ban without username in ${message.guild.name}`);
            message.reply(':warning: Please specify the player you want to ban.');
            return;
        }

		console.log(`${message.member.user.tag} executed /ban ${username} ${reason} in ${message.guild.name}`);

		const mcUsername = message.mentions.users.first()?.id ? await utils.getUsername(message.mentions.users.first()?.id, message) : username;
		if(!mcUsername) return;

		const resp = await plugin.execute(`ban ${mcUsername} ${reason}`, message);
		if(!resp) return;

		const respEmbed = new Discord.MessageEmbed()
			.setTitle('Ban Player')
			.setColor('ORANGE');

		if(resp.startsWith('&c')) respEmbed.setDescription(`Warning trying to ban player [**${username}**]: ${resp.replace('&c', '')}`);
		else if(resp.startsWith('Could not fetch response message!')) respEmbed.setDescription(`:warning: Successfully executed ban player [**${username}**]: \`${reason}\`\n${resp}`);
		else respEmbed.setDescription(`<:Checkmark:849224496232660992> Successfully banned player [**${username}**]: \`${reason}\``);
		message.reply({ embeds: [respEmbed] });
	}
}