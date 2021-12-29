const Discord = require('discord.js')
const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'disable',
    aliases: ['unable'],
    usage: 'disable commands/stats/advancements <command/stat/advancement> **//**\ndisable list commands/stats/advancements',
    example: '/disable commands txp **//** /disable stats picked_up **//** /disable advancements adventuring_time **//** /disable list commands',
    description: 'Disable a specific command/stat/advancement. List of disabled commands/stats/advancements with `/disable list`.\n Command-disabling is also possible through buttons in /help <command>.',
    data: new SlashCommandBuilder()
            .setName('disable')
            .setDescription('Disable a specific command/stat/advancement.')
            .addSubcommand(subcommand =>
                subcommand.setName('commands')
                .setDescription('Disable a command.')
                .addStringOption(option =>
                    option.setName('command')
                    .setDescription('Set the command you want to disable.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('advancements')
                .setDescription('Disable an advancement')
                .addStringOption(option =>
                    option.setName('advancement')
                    .setDescription('Set the advancement you want to disable.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('stats')
                .setDescription('Disable a stat.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set the stat you want to disable.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('list')
                .setDescription('Get a list of all disabled stats/advancements/commands.')
                .addStringOption(option =>
                    option.setName('category')
                    .setDescription('Set the category of which you want a list.')
                    .setRequired(true)
                    .addChoice('commands', 'commands')
                    .addChoice('advancements', 'advancements')
                    .addChoice('stats', 'stats')
                )
            ),
    async execute(message, args) {
        let type = args[0];
        let toDisableList = args[1];

        if(!type) {
            console.log(`${message.member.user.tag} executed /disable without type in ${message.guild.name}`);
            message.reply(':warning: Please specify the type you want to disable (`commands`, `stats, `advancements` or `list` if you want to list the disabled commands/stats/advancements.)');
            return;
        }

        if (type === 'list') {
            if (toDisableList === 'command' || toDisableList === 'cmd' || toDisableList === 'commands' || toDisableList === 'cmds') type = 'commands';
            else if (toDisableList === 'advancements' || message.client.commands.get('advancements').aliases.includes(toDisableList)) type = 'advancements';
            else if (toDisableList === 'stats' || message.client.commands.get('stats').aliases.includes(toDisableList)) type = 'stats';
            else {
                console.log(`${message.member.user.tag} executed /disable list with wrong type in ${message.guild.name}`);
                message.reply(':warning: Wrong Usage! You can only list `commands`, `stats` or `advancements`.');
                return;
            }

            console.log(`${message.member.user.tag} executed /disable list ${toDisableList} in ${message.guild.name}`);

            fs.readdir(`./disable/${type}`, (err, list) => {
                if(err) {
                    console.log(`Error reading disableList [${type}] directory.`, err);
                    message.reply(`<:Error:849215023264169985> Could not list disabled ${type}.`);
                    return;
                }

                if(list.length === 0) {
                    console.log(`No disabled ${type}.`);
                    message.reply(`<:Checkmark:849224496232660992> No disabled ${type} :)`);
                } else {
                    const listEmbed = new Discord.MessageEmbed()
                        .setTitle('Disable List')
                        .setColor('RED')
                        .setAuthor('Minecraft SMP Bot', message.client.user.displayAvatarURL({ format: 'png' }))
                        .addField(`==============\nDisabled ${type}`, '**==============**')

                    for(const entry of list) listEmbed.addField(entry.replace(`${message.guild.id}_`, '').toUpperCase(), '\u200B');
                    message.reply({ embeds: [listEmbed] });
                }
            });

        } else {
            console.log(`${message.member.user.tag} executed /disable ${type} ${toDisableList} in ${message.guild.name}`);

            if (type === 'command' || type === 'cmd' || type === 'commands' || type === 'cmds') type = 'commands';
            else if (type === 'advancements' || message.client.commands.get('advancements').aliases.includes(type)) type = 'advancements';
            else if (type === 'stats' || message.client.commands.get('stats').aliases.includes(type)) type = 'stats';
            else {
                console.log(`${message.member.user.tag} executed /disable with wrong type in ${message.guild.name}`);
                message.reply(':warning: Wrong Usage! You can only disable `commands`, `stats` or `advancements`.');
                return;
            }
            if(!toDisableList) {
                console.log(`${message.member.user.tag} executed /disable ${type} without toDisable in ${message.guild.name}`);
                message.reply(':warning: Wrong Usage! You can only disable `commands`, `stats` or `advancements`.');
                return;
            }

            if(type === 'commands') {
                toDisableList = (message.client.commands.get(toDisableList) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(toDisableList)))?.name;

                if(!toDisableList) {
                    console.log(`Command [${toDisableList}] doesn't exist.`);
                    message.reply(`:warning: Command [**${toDisableList}**] doesn't exist.`);
                    return;
                }
            }

            fs.writeFile(`./disable/${type}/${message.guild.id}_${toDisableList}`, '', err => {
                if (err) {
                    console.log(`Error trying to write ${type} ${toDisableList}`, err);
                    message.reply(`<:Error:849215023264169985> Could not disable ${type} [**${toDisableList}**]!`);
                    return;
                }
                console.log(`Successfully wrote ${type} disableFile [./disable/${type}/${message.guild.id}_${toDisableList}].`);
                message.reply(`<:Checkmark:849224496232660992> Successfully disabled ${type} [**${toDisableList}**].`);
            });
        }
	}
}