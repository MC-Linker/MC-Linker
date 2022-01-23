const Discord = require('discord.js')
const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');
const utils = require('../../api/utils');

module.exports = {
    name: 'disable',
    aliases: ['unable'],
    usage: 'disable commands/stats/advance,emts <command/stat/advancement> **//**\ndisable list commands/stats/advancements',
    example: '/disable commands txp **//** /disable stats picked_up **//** /disable advancements adventuring_time **//** /disable list commands',
    description: 'Disable a specific command/stat/advancement. List of disabled commands/stats/advancements with `/disable list`.\n Command-disabling is also possible through buttons in /help <command>.',
    data: new SlashCommandBuilder()
            .setName('disable')
            .setDescription('Disable a specific command/stat/advancement.')
            .addSubcommand(subcommand =>
                subcommand.setName('commands')
                .setDescription('Disable a command')
                .addStringOption(option =>
                    option.setName('command')
                    .setDescription('Set the command you want to disable')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('advancements')
                .setDescription('Disable an advancement')
                .addStringOption(option =>
                    option.setName('advancement')
                    .setDescription('Set the advancement you want to disable')
                    .setRequired(true)
                    .setAutocomplete(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('stats')
                .setDescription('Disable a stat.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set the stat you want to disable')
                    .setRequired(true)
                    .setAutocomplete(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('list')
                .setDescription('Get a list of all disabled stats/advancements/commands')
                .addStringOption(option =>
                    option.setName('category')
                    .setDescription('Set the category of which you want a list')
                    .setRequired(true)
                    .addChoice('commands', 'commands')
                    .addChoice('advancements', 'advancements')
                    .addChoice('stats', 'stats')
                )
            ),
    async autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        if(subcommand === 'advancements') {
            const matchingTitles = await utils.searchAllAdvancements(focused);
            interaction.respond(matchingTitles);
        } else if(subcommand === 'stats') {
            const respondArray = [];
            ['entities', 'items'].forEach(imgType => {
                fs.readdir(`./images/minecraft/${imgType}`, (err, images) => {
                    const matchingImages = images.filter(image => image.includes(focused.replaceAll(' ', '_')));
                    if (matchingImages.length >= 25) matchingImages.length = 25;

                    matchingImages.forEach(image => {
                        let formattedImage = image.replaceAll('.png', '');
                        formattedImage = formattedImage.split('_').map(word => word.cap()).join(' ');

                        respondArray.push({
                            name: formattedImage,
                            value: image.replaceAll('.png', ''),
                        });
                    });

                    if(imgType === 'items') {
                        if(respondArray.length >= 25) respondArray.length = 25;
                        interaction.respond(respondArray);
                    }
                });
            });
        }
    },
    async execute(message, args) {
        let type = args?.shift();
        let toDisableList = args?.join(' ').toLowerCase();

        if(!type) {
            console.log(`${message.member.user.tag} executed /disable without type in ${message.guild.name}`);
            message.reply(':warning: Please specify the type you want to disable (`commands`, `stats, `advancements` or `list` if you want to list the disabled commands/stats/advancements.)');
            return;
        }

        if (type === 'list') {
            if(toDisableList === 'command' || toDisableList === 'cmd' || toDisableList === 'commands' || toDisableList === 'cmds') type = 'commands';
            else if(toDisableList === 'advancements' || message.client.commands.get('advancements').aliases.includes(toDisableList)) type = 'advancements';
            else if(toDisableList === 'stats' || message.client.commands.get('stats').aliases.includes(toDisableList)) type = 'stats';
            else {
                console.log(`${message.member.user.tag} executed /disable list with wrong type in ${message.guild.name}`);
                message.reply(':warning: You can only list `commands`, `stats` or `advancements`.');
                return;
            }

            console.log(`${message.member.user.tag} executed /disable list ${toDisableList} in ${message.guild.name}`);

            fs.readdir(`./disable/${type}`, async (err, disabled) => {
                if(err) {
                    console.log(`Error reading disableList ${type} directory.`, err);
                    message.reply(`<:Error:849215023264169985> Could not list disabled ${type}.`);
                    return;
                }

                disabled = disabled.filter(disable => disable.startsWith(message.guildId));


                if(disabled.length === 0) {
                    console.log(`No disabled ${type}.`);
                    message.reply(`<:Checkmark:849224496232660992> There are no disabled ${type}.`);
                } else {
                    const listEmbed = new Discord.MessageEmbed()
                        .setTitle('Disable List')
                        .setColor('RED')
                        .addField(`==============\nDisabled ${type}`, '**==============**')

                    for(let disable of disabled) {
                        disable = disable.replace(`${message.guildId}_`, '');

                        if(type === 'advancements') {
                            const matchingTitle = await utils.searchAllAdvancements(disable, true, 1);
                            disable = matchingTitle.shift()?.name ?? disable;
                        } else if (type === 'stats') disable = disable.split('_').map(word => word.cap()).join(' ');
                        else disable = disable.cap();

                        listEmbed.addField(disable, '\u200B');
                    }

                    message.reply({ embeds: [listEmbed]});
                }
            });

        } else {
            if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
                console.log(`${message.member.user.tag} executed /disable ${type} without admin in ${message.guild.name}`);
                message.reply(':no_entry: This command can only be executed by admins.');
                return;
            }

            console.log(`${message.member.user.tag} executed /disable ${type} ${toDisableList} in ${message.guild.name}`);

            if (type === 'command' || type === 'cmd' || type === 'commands' || type === 'cmds') type = 'commands';
            else if (type === 'advancements' || message.client.commands.get('advancements').aliases.includes(type)) type = 'advancements';
            else if (type === 'stats' || message.client.commands.get('stats').aliases.includes(type)) type = 'stats';
            else {
                console.log(`${message.member.user.tag} executed /disable with wrong type in ${message.guild.name}`);
                message.reply(':warning: You can only disable `commands`, `stats` or `advancements`.');
                return;
            }
            if(!toDisableList) {
                console.log(`${message.member.user.tag} executed /disable ${type} without toDisable in ${message.guild.name}`);
                message.reply(':warning: You can only disable `commands`, `stats` or `advancements`.');
                return;
            }

            let formattedToDisable;
            if(type === 'commands') {
                const command = message.client.commands.get(toDisableList) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(toDisableList));

                if(!command) {
                    console.log(`Command [${toDisableList}] doesn't exist.`);
                    message.reply(`:warning: Command [**${toDisableList}**] doesn't exist.`);
                    return;
                }

                toDisableList = command.name;
                formattedToDisable = toDisableList.cap();
            } else if(type === 'advancements') {
                const matchingTitle = await utils.searchAllAdvancements(toDisableList, true, 1);
                formattedToDisable = matchingTitle.shift()?.name ?? toDisableList.cap();
            } else if(type === 'stats') formattedToDisable = toDisableList.split('_').map(word => word.cap()).join(' ');

            fs.writeFile(`./disable/${type}/${message.guild.id}_${toDisableList}`, '', err => {
                if (err) {
                    console.log(`Error trying to write ${type} ${toDisableList}`, err);
                    message.reply(`<:Error:849215023264169985> Could not disable ${type} [**${toDisableList}**].`);
                    return;
                }
                console.log(`Successfully wrote disableFile [./disable/${type}/${message.guild.id}_${toDisableList}].`);
                message.reply(`<:Checkmark:849224496232660992> Successfully disabled ${type} [**${formattedToDisable}**].`);
            });
        }
	}
}