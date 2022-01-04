const Discord = require('discord.js')
const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'disable',
    aliases: ['unable'],
    usage: 'disable commands/stats/advance,emts <command/stat/advancement> **//**\ndisable list commands/stats/advancements',
    example: '/disable commands txp **//** /disable stats picked_up **//** /disable advancements adventuring_time **//** /disable list commands',
    description: 'Disable a specific command/stat/advancement. List of disabled commands/stats/advancements with `/disable list`.\n Command-disabling is also possible through buttons in /help <command>.',
    data: new SlashCommandBuilder()
            .setName('disable')
            .setDescription('Disable a specific command/stat/advancement')
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
    autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        const advancementCategories = interaction.client.commands.get('advancements').advancementTitles.categories;

        if(subcommand === 'advancements') {
            const matchingTitles = [];
            advancementCategories.forEach(category => {
                const matchingCategoryTitles = category.titles.filter(advancement => advancement.name.toLowerCase().includes(focused));
                matchingCategoryTitles.forEach(title => matchingTitles.push(title));
            });

            if(matchingTitles.length >= 25) matchingTitles.length = 25;
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
            if (toDisableList === 'command' || toDisableList === 'cmd' || toDisableList === 'commands' || toDisableList === 'cmds') type = 'commands';
            else if (toDisableList === 'advancements' || message.client.commands.get('advancements').aliases.includes(toDisableList)) type = 'advancements';
            else if (toDisableList === 'stats' || message.client.commands.get('stats').aliases.includes(toDisableList)) type = 'stats';
            else {
                console.log(`${message.member.user.tag} executed /disable list with wrong type in ${message.guild.name}`);
                message.reply(':warning: You can only list `commands`, `stats` or `advancements`.');
                return;
            }

            console.log(`${message.member.user.tag} executed /disable list ${toDisableList} in ${message.guild.name}`);

            fs.readdir(`./disable/${type}`, (err, disabled) => {
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
                            const advancementCategories = message.client.commands.get('advancements').advancementTitles.categories;
                            let matchingTitle;
                            advancementCategories.forEach(category => {
                                if(!matchingTitle) matchingTitle = category.titles.find(title => title.value.toLowerCase() === disable);
                            });
                            disable = matchingTitle?.name ?? disable;
                        } else if(type === 'stats') disable = disable.split('_').map(word => word.cap()).join(' ');
                        else disable = disable.cap();

                        listEmbed.addField(disable, '\u200B');
                    }

                    message.reply({ embeds: [listEmbed] });
                }
            });

        } else {
            const advancementCategories = message.client.commands.get('advancements').advancementTitles.categories;
            let matchingTitle;
            advancementCategories.forEach(category => {
                if(!matchingTitle) matchingTitle = category.titles.find(title => title.name.toLowerCase() === toDisableList);
            });
            toDisableList = matchingTitle?.value ?? toDisableList;

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
                const advancementCategories = message.client.commands.get('advancements').advancementTitles.categories;

                let matchingTitle;
                advancementCategories.forEach(category => {
                    if(!matchingTitle) matchingTitle = category.titles.find(title => title.value === toDisableList);
                });

                formattedToDisable = matchingTitle?.name ?? toDisableList.cap();
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