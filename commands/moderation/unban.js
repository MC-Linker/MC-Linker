const utils = require('../../utils');
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
		await message.deferReply();
		if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
			message.reply(':no_entry: ' + "This command can only be used with `Ban member` permission!");
            console.log(message.member.user.tag + ' executed /unban without banperm in ' + message.guild.name);
            return;
		}

		if(!args[0]) {
            console.log(message.member.user.tag + ' executed /unban without user in ' + message.guild.name);
            message.reply(':warning: Please specify the player you want to unban.');
            return;
        }

		let username = args[0];
		if(message.mentions.users.size) username = await utils.getUsername(message.mentions.users.first(), message);

		const uuidv4 = await utils.getUUIDv4(message.mentions.users.first(), message);
		if(!uuidv4) return;

		console.log(message.member.user.tag + ' executed /unban with taggedUser: ' + username + ' in ' + message.guild.name);

		await plugin.execute(`pardon ${uuidv4}`, message);

		const respEmbed = new Discord.MessageEmbed().setTitle('Unban player').setColor('BLUE').setDescription(`Successfully unbanned player [**${username}**]`);
		message.reply({ embeds: [respEmbed] });
	}
}