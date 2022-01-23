const { discordLink } = require('../config.json');
const fs = require('fs');
const Discord = require('discord.js');
const {SlashCommandBuilder} = require("@discordjs/builders");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Detailed Description of every command.')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Set the command or category of which you want to get infos.')
                .setRequired(false)
        ),
    execute: function(message, args) {
        const baseEmbed = new Discord.MessageEmbed()
            .setTitle('Help Menu')
            .setAuthor({ name: message.client.user.username, iconURL: message.client.user.displayAvatarURL({ format: 'png' }) })
            .setColor('NOT_QUITE_BLACK');

        if(!args[0]) {
            console.log(`${message.member.user.tag} executed /help in ${message.guild.name}`);

            const helpEmbed = baseEmbed.addField(':label: Main :label:', 'Main commands such as `/inventory`, or `/advancements`.')
                .addField(':shield: Moderation :shield:', 'Moderation commands such as `/ban` or `/unban`.')
                .addField(':point_right: Other :point_left:', 'Other commands such as `/message` or `/text`.')
                .addField(':gear: Settings :gear:', 'Setup and settings such as `/connect` or `/disable`')
                .addField('\u200B', `**All commands in a category** can be viewed with: **/help <category>**\n**Still need help?** => [Support Discord Server](${discordLink})`);

            message.reply({ embeds: [helpEmbed], allowedMentions: { repliedUser: false } });
        } else {
            const commandName = args[0].toLowerCase();

            let command = message.client.commands.get(commandName) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
            if (!command) {
                fs.readdir(`./commands/${commandName}`, (err, commands) => {
                    if(err) {
                        console.log(`${message.member.user.tag} executed non-existent help command/category ${commandName} in ${message.guild.id}`);
                        message.reply(`:warning: That command/category [**${commandName}**] doesnt exist.`);
                        return;
                    }
                    console.log(`${message.member.user.tag} executed /help ${commandName} in ${message.guild.name}`);

                    commands = commands.filter(command => command.endsWith('.js'));
                    const helpEmbed = baseEmbed;
                    commands.forEach(commandFile => {
                        commandFile = commandFile.split('.').shift();
                        command = message.client.commands.get(commandFile) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandFile));
                        helpEmbed.addField(command.name.toUpperCase(), command.description);
                    });
                    helpEmbed.addField('\u200B', `**More info to a command** can be viewed with: **/help <command>**\n**Still need help?** => [Support Discord Server](${discordLink})`);
                    message.reply({ embeds: [helpEmbed] });
                });
            } else {
                console.log(`${message.member.user.tag} executed /help ${commandName} in ${message.guild.name}`);

                const helpEmbed = baseEmbed.addField(command.name.toUpperCase(), `${command.description} \n\n**USAGE**: \n${command.usage}\n\n**EXAMPLE**: \n${command.example}`);
                if(command.aliases[0]) helpEmbed.addField('\n**ALIASES**', command.aliases.join(', '));

                const disableRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle('DANGER')
                            .setCustomId('disable_' + command.name)
                            .setLabel('Disable this command!')
                            .setEmoji('<:Error:849215023264169985>'),
                    );
                const enableRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle('SUCCESS')
                            .setCustomId('enable_' + command.name)
                            .setLabel('Enable this command!')
                            .setEmoji('<:Checkmark:849224496232660992>'),
                    );

                const disabled = fs.existsSync(`./disable/commands/${message.guild.id}_${command.name}`);
                if (!disabled) message.reply({ embeds: [helpEmbed], components: [disableRow], allowedMentions: { repliedUser: false } });
                else if (disabled) {
                    helpEmbed.setDescription('You can find helpful information here. \n ```diff\n- [COMMAND DISABLED]```');
                    message.reply({ embeds: [helpEmbed], components: [enableRow] });
                }
            }
        }
    }
}