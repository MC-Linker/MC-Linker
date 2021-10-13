const Discord = require('discord.js')
const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'disable',
    aliases: ['unable'],
    usage: 'disable commands/stats/advancements <command/stat/advancement> **//**\ndisable list commands/stats/advancements',
    example: 'disable commands txp **//** disable stats picked_up **//** disable advancements adventuring_time **//** disable list commands',
    description: 'Disable a specific command/stat/advancement. List of disabled commands/stats/advancements with `^disable list`.\n Command-disabling is also possible through buttons in ^help <command>.',
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
                    .addChoice('advancements', 'advancements')
                    .addChoice('inventory', 'inventory')
                    .addChoice('stats', 'stats')
                    .addChoice('ban', 'ban')
                    .addChoice('unban', 'unban')
                    .addChoice('chat', 'chat')
                    .addChoice('message', 'message')
                    .addChoice('text', 'text')
                    .addChoice('txp', 'txp')
                    .addChoice('connect', 'connect')
                    .addChoice('disable', 'disable')
                    .addChoice('disconnect', 'disconnect')
                    .addChoice('enable', 'enable')
                    .addChoice('ftp', 'ftp')
                    .addChoice('rcon', 'rcon')
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
    execute(message, args) {
        const mode = (args[0]);
        let object = (args[1]);

        if(!mode || !object) {
            console.log(message.member.user.tag + ' executed ^disable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `^help disable` for correct usage!");
        } else if (mode === 'list') {
            let listMode;
            if (object === 'command' || object === 'cmd' || object === 'commands' || object === 'cmds') listMode = 'commands';
            else if (object === 'advancements' || message.client.commands.get('advancements').aliases.includes(object)) listMode = 'advancements';
            else if (object === 'stats' || message.client.commands.get('stats').aliases.includes(object)) listMode = 'stats';
            else {
                console.log(message.member.user.tag + ' executed ^disable list wrong. ListObject: ' + object + ' in ' + message.guild.name);
                message.reply(":warning: Wrong Usage! You can only list `stats`, `commands` and `advancements`.");
                return;
            }

            console.log(message.member.user.tag + ' executed ^disable list ' + object + ' in ' + message.guild.name);

            fs.readdir(`./disable/${listMode}`, (err, list) => {
                if(err) {
                    console.log('Error reading disableList [' + listMode + '] dir.', err);
                    message.reply('<:Error:849215023264169985> Error trying to list disabled commands.');
                    return;
                }

                const indexGit = list.indexOf('GitInit.json');
                if (indexGit > -1) list.splice(indexGit, 1);

                if(list.length === 0) {
                    console.log(`No disabled ${listMode}.`);
                    message.reply(`<:Checkmark:849224496232660992> No disabled ${listMode} :)`);
                    return;
                } else {
                    const listEmbed = new Discord.MessageEmbed()
                    .setTitle('Disable List')
                    .setColor('RED')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .addField(`==============\nDisabled ${listMode}`, '**==============**')
                    list.forEach(entry => {
                        entry = entry.replace(`${message.guild.id}_`, '');
                        entry = entry.toUpperCase();
                        listEmbed.addField(entry, '\u200B');
                    });
                    message.reply({ embeds: [listEmbed] });
                }
            });

        } else {
            console.log(message.member.user.tag + ' executed ^disable ' + mode + ' ' + object + ' in ' + message.guild.name);

            let disableMode;
            if (mode === 'command' || mode === 'cmd' || mode === 'commands' || mode === 'cmds') disableMode = 'commands';
            else if (mode === 'advancements' || message.client.commands.get('advancements').aliases.includes(mode)) disableMode = 'advancements';
            else if (mode === 'stats' || message.client.commands.get('stats').aliases.includes(mode)) disableMode = 'stats';
            else {
                console.log("Wrong Usage of ^disable");
                message.reply(":warning: Wrong Usage! Check `^help disable` for correct usage!");
                return;
            }

            let disObject = object;
            try {
                if(disableMode === 'commands') disObject = message.client.commands.find(cmd => cmd.name && cmd.name === object) || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(object));
                if(typeof disObject === 'object') disObject = disObject.name;
                else if(!disObject) {
                    console.log(disableMode + " [" + object + "] doesn't exist.");
                    message.reply(":warning: " + disableMode + " [**" + object + "**] doesn't exist.");
                    return;
                }
                fs.writeFile(`./disable/${disableMode}/${message.guild.id}_${disObject}`, '', err => {
                    if (err) {
                        console.log(`Error trying to write ${disableMode} DisableFile of ` + disObject, err);
                        message.reply(`<:Error:849215023264169985> Could not disable ${disableMode} [${disObject}}]!`);
                        return;
                    }
                    console.log(`Succesfully wrote ${disableMode} DisableFile [` + `./disable/${disableMode}/${message.guild.id}_${disObject}` + '].');
                    message.reply(`<:Checkmark:849224496232660992> Succesfully disabled ${disableMode} [**` + disObject + '**].');
                });
            } catch (err) {
                console.log(disableMode + " [" + object + "] doesn't exist.", err);
                message.reply(":warning: " + disableMode + " [**" + object + "**] doesn't exist.");
                return;
            }

        }
	}
}