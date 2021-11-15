const utils = require('../../utils');
const ftp = require('../../api/ftp');
const plugin = require('../../api/plugin');
const fs = require('fs');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'ban',
    aliases: ['banplayer', 'banuser'],
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
		await message.deferReply();
		if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
			message.reply(':no_entry: ' + "This command can only be used with `Ban member` permission!");
            console.log(message.member.user.tag + ' executed /ban without banperm in ' + message.guild.name);
            return;
		}

		if(!args[0]) {
            console.log(message.member.user.tag + ' executed /ban without user in ' + message.guild.name);
            message.reply(':warning: Please specify the player you want to ban.');
            return;
        }

		let username = args.shift();
		if(message.mentions.users.size) username = await utils.getUsername(message.mentions.users.first(), message);

		const uuidv4 = await utils.getUUIDv4(message.mentions.users.first(), message);

		let reason;
		if (!args) reason = 'Banned by an operator.';
		else reason = args.join(' ');

		console.log(message.member.user.tag + ' executed /ban with taggedUser: ' + username + ' ' + reason + ' in ' + message.guild.name);
		await plugin.execute(`ban ${uuidv4} ${reason}`, message);

		const respEmbed = new Discord.MessageEmbed().setTitle('Ban player').setColor('ORANGE').setDescription(`<:Checkmark:849224496232660992> Successfully banned player [**${username}**]`);
		message.reply({ embeds: [respEmbed] });
	}
}