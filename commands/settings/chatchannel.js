const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
const { Constants } = require('discord.js');
const fs = require('fs');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');

module.exports = {
    name: 'chatchannel',
    aliases: ['setchatchannel', 'logchannel', 'setlogchannel'],
    usage: 'chatchannel <channel>',
    example: 'chatchannel #smp-chat',
    description: 'Setup a channel in which the bot will send minecraft chat messages and logs.',
    data: new SlashCommandBuilder()
            .setName('chatchannel')
            .setDescription('Setup a channel in which the bot will send minecraft chat messages and logs.')
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('Set the channel.')
                .setRequired(true)
                .addChannelTypes([Constants.ChannelTypes.GUILD_TEXT, Constants.ChannelTypes.GUILD_NEWS, Constants.ChannelTypes.GUILD_PUBLIC_THREAD, Constants.ChannelTypes.GUILD_PRIVATE_THREAD,  Constants.ChannelTypes.GUILD_NEWS_THREAD])
            ),
    async execute(message, args) {
        let channel = message.mentions.channels?.first() ?? args[0];

        if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            console.log(`${message.member.user.tag} executed /chatchannel ${channel.name} without admin in ${message.guild.name}`);
            message.reply(':no_entry: You have to be an admin to execute this command.');
            return;
        } else if(!channel) {
            console.log(`${message.member.user.tag} executed /chatchannel without args in ${message.guild.name}`);
            message.reply(':warning: Please mention a channel.');
            return;
        } else if(!channel.isText()) {
            console.log(`${message.member.user.tag} executed /chatchannel without args in ${message.guild.name}`);
            message.reply(':warning: Please mention a text, thread or news channel.');
            return;
        }

        console.log(`${message.member.user.tag} executed /chatchannel ${channel.name} in ${message.guild.name}`);


        const logChooser = new Discord.MessageActionRow()
            .addComponents(
                new Discord.MessageSelectMenu()
                    .setCustomId('log')
                    .setMinValues(1)
                    .setMaxValues(8)
                    .setPlaceholder('Select up to 8 message types.')
                    .addOptions([
                        {
                            label: 'Chat messages',
                            description: 'Send a message every time a player chats.',
                            value: '0',
                        },
                        {
                            label: 'Join messages',
                            description: 'Send a message every time a player joins the server.',
                            value: '1',
                        },
                        {
                            label: 'Leave messages',
                            description: 'Send a message every time a player leaves the server.',
                            value: '2',
                        },
                        {
                            label: 'Advancement messages',
                            description: 'Send a message every time a player completes an advancement.',
                            value: '3',
                        },
                        {
                            label: 'Death messages',
                            description: 'Send a message every time a player dies.',
                            value: '4',
                        },
                        {
                            label: 'Command messages',
                            description: 'Send a message every time a player executes a command.',
                            value: '5',
                        },
                        {
                            label: 'Startup messages',
                            description: 'Send a message every time the server starts up.',
                            value: '6',
                        },
                        {
                            label: 'Shutdown messages',
                            description: 'Send a message every time the server shuts down.',
                            value: '7',
                        },
                    ]),
        );

        const logChooserMsg = await message.reply({ content: 'Select all message types you want the bot to send. (You have 20 seconds to select)', components: [logChooser] });
        const collector = logChooserMsg.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 20000, max: 1 });
        collector.on('collect', async menu => {
            if(menu.customId === 'log' && menu.member.user.id === message.member.user.id) {
                const ip = await utils.getIp(message.guild.id, message);
                if(!ip) return;

                const regChannel = await plugin.registerChannel(ip, message.guildId, channel.id, menu.values, menu);
                if(!regChannel) return;

                const pluginJson = {
                    "ip": regChannel.ip,
                    "version": regChannel.version.split('.')[1],
                    "path": regChannel.path,
                    "hash": regChannel.hash,
                    "guild": regChannel.guild,
                    "chat": true,
                    "types": regChannel.types,
                    "channel": regChannel.channel,
                    "protocol": "plugin"
                }

                fs.writeFile(`./serverdata/connections/${message.guild.id}/connection.json`, JSON.stringify(pluginJson, null, 2), 'utf-8', err => {
                    if(err) {
                        console.log('Error writing pluginFile', err);
                        menu.reply('<:Error:849215023264169985> Couldn\'t save channel. Please try again.');
                        return;
                    }
                    console.log('Successfully set chat channel');
                    menu.reply('<:Checkmark:849224496232660992> Successfully set the chat channel');
                });
            } else menu.reply({ content: ':warning: Only the command sender can select message types.', ephemeral: true });
        });
        collector.on('end', collected => {
            if(!collected.size) message.reply('Select all message types you want the bot to send. (Time ran out)');
            else message.reply('Select all message types you want the bot to send. (Already responded)');
        });
	}
}