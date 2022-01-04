const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'enable',
    aliases: [],
    usage: 'enable commands/stats/advancements <command/stat/advancement>',
    example: '/enable commands txp **//** /enable stats picked_up **//** /enable advancements adventuring_time',
    description: 'Enable a disabled command/stat/advancement (They\'re all enabled by default). Command-enabling is also possible through buttons in /help <command>.',
    data: new SlashCommandBuilder()
            .setName('enable')
            .setDescription('Enable a disabled command/stat/advancement (All enabled by default)')
            .addSubcommand(subcommand =>
                subcommand.setName('commands')
                .setDescription('Enable a disabled command')
                .addStringOption(option =>
                    option.setName('command')
                    .setDescription('Set the command you want to enable')
                    .setRequired(true)
                    .setAutocomplete(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('stats')
                .setDescription('Enable a disabled stat')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set the stat you want to enable')
                    .setRequired(true)
                    .setAutocomplete(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('advancements')
                .setDescription('Enable a disabled advancement')
                .addStringOption(option =>
                    option.setName('advancement')
                    .setDescription('Set the advancement you want to enable')
                    .setRequired(true)
                    .setAutocomplete(true)
                )
            ),
    autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        fs.readdir(`./disable/${subcommand}`, (err, disabled) => {
            if(err) return;

            const matchingDisabled = disabled.filter(disable => disable.startsWith(interaction.guild.id) && disable.includes(focused));
            if(matchingDisabled.length >= 25) matchingDisabled.length = 25;

            const respondArray = [];
            matchingDisabled.forEach(disable => {
                disable = disable.replaceAll(`${interaction.guildId}_`, '')
                let formattedDisable;

                if(subcommand === 'advancements') {
                    const advancementCategories = interaction.client.commands.get('advancements').advancementTitles.categories;

                    let matchingTitle;
                    advancementCategories.forEach(category => {
                        if(!matchingTitle) matchingTitle = category.titles.find(title => title.value === disable);
                    });

                    formattedDisable = matchingTitle?.name ?? disable.cap();
                } else if(subcommand === 'stats') formattedDisable = disable.split('_').map(word => word.cap()).join(' ');
                else formattedDisable = disable.cap();

                respondArray.push({
                    name: formattedDisable,
                    value: disable,
                });
            });

            interaction.respond(respondArray);
        });

    },
    async execute(message, args) {
        let type = args?.shift();
        let toEnable = args?.join(' ').toLowerCase();

        if(!type) {
            console.log(`${message.member.user.tag} executed /enable without type in ${message.guild.name}`);
            message.reply(':warning: Please specify the type you want to enable (`commands`, `stats`, `advancements`).');
            return;
        } else if(!toEnable) {
            console.log(`${message.member.user.tag} executed /enable without toEnable in ${message.guild.name}`);
            message.reply(':warning: Please specify the command, stat or advancement you want to enable.');
            return;
        }

        const advancementCategories = message.client.commands.get('advancements').advancementTitles.categories;
        let matchingTitle;
        advancementCategories.forEach(category => {
            if(!matchingTitle) matchingTitle = category.titles.find(title => title.name.toLowerCase() === toEnable);
        });
        toEnable = matchingTitle?.value ?? toEnable;

        console.log(`${message.member.user.tag} executed /enable ${type} ${toEnable} in ${message.guild.name}`);

        if (type === 'command' || type === 'cmd' || type === 'commands' || type === 'cmds') type = 'commands';
        else if (type === 'advancements' || message.client.commands.get('advancements').aliases.includes(type)) type = 'advancements';
        else if (type === 'stats' || message.client.commands.get('stats').aliases.includes(type)) type = 'stats';
        else {
            console.log(`${message.member.user.tag} executed /enable with wrong type in ${message.guild.name}`);
            message.reply(':warning: You can only enable `commands`, `stats` or `advancement`.');
            return;
        }

        let formattedToEnable;
        if(type === 'commands') {
            const command = message.client.commands.get(toEnable) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(toEnable));

            if(!command) {
                console.log(`Command [${toEnable}] doesn't exist.`);
                message.reply(`:warning: Command [**${toEnable}**] doesn't exist.`);
                return;
            }

            toEnable = command.name;
            formattedToEnable = toEnable.cap();
        } else if(type === 'advancements') {
            const advancementCategories = message.client.commands.get('advancements').advancementTitles.categories;

            let matchingTitle;
            advancementCategories.forEach(category => {
                if(!matchingTitle) matchingTitle = category.titles.find(title => title.value === toEnable);
            });

            formattedToEnable = matchingTitle?.name ?? toEnable.cap();
        } else if(type === 'stats') formattedToEnable = toEnable.split('_').map(word => word.cap()).join(' ');

        fs.access(`./disable/${type}/${message.guild.id}_${toEnable}`, err => {
            if (err) {
                console.log(`${type} ${toEnable} is already enabled.`);
                message.reply(`:warning: ${type.cap()} [**${toEnable}**] is already enabled.`);
                return;
            }

            fs.rm(`./disable/${type}/${message.guild.id}_${toEnable}`, err => {
                if (err) {
                    console.log(`Error trying to delete ${type} ${toEnable}`, err);
                    message.reply(`<:Error:849215023264169985> Could not enable ${type} [**${toEnable}**].`);
                    return;
                }
                console.log(`Successfully deleted enableFile [./disable/${type}/${message.guild.id}_${toEnable}].`);
                message.reply(`<:Checkmark:849224496232660992> Successfully enabled ${type} [**${formattedToEnable}**].`);
            });
        });
	}
}