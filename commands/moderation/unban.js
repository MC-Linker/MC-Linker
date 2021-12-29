const utils = require('../../api/utils');
const ftp = require('../../api/ftp');
const fs = require('fs');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'unban',
    aliases: ['pardon'],
    usage: 'unban <mention/username>',
    example: '/unban @Lianecx **//** /unban MrNotCheating',
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

		const mcUsername = await utils.getUsername(message.mentions.users.first().id, message);
		if(!mcUsername) return;

		console.log(`${message.member.user.tag} executed /unban ${username} in ${message.guild.name}`);

		const execute = await plugin.execute(`pardon ${mcUsername}`, message);
		if(!execute) return;

		const respEmbed = new Discord.MessageEmbed()
			.setTitle('Unban player')
			.setColor('BLUE')
			.setDescription(`<:Checkmark:849224496232660992> Successfully unbanned player [**${username}**]`);
		message.reply({ embeds: [respEmbed] });
	}
}