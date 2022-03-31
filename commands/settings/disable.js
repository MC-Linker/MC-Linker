const Discord = require('discord.js');
const fs = require('fs');
const utils = require('../../api/utils');
const settings = require('../../api/settings');

async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    if(subcommand === 'advancements') {
        const matchingTitles = await utils.searchAllAdvancements(focused);
        interaction.respond(matchingTitles);
    } else if(subcommand === 'stats') {
        const respondArray = [];
        ['entities', 'items'].forEach(imgType => {
            fs.readdir(`./resources/images/minecraft/${imgType}`, (err, images) => {
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
                    interaction.respond(respondArray).catch(err => console.log(`Could not respond to autocomplete ${interaction.commandName}`, err));
                }
            });
        });
    }
}

async function execute(message, args) {
    let type = args?.shift();

    const disabledCommands = ['enable', 'disable', 'help'];

    if(!type) {
        console.log(`${message.member.user.tag} executed /disable without type in ${message.guild.name}`);
        message.reply(':warning: Please specify the type you want to disable (`commands`, `stats, `advancements`) or `list` if you want to list the disabled commands/stats/advancements.');
        return;
    }

    if (type === 'list') {
        const toList = args?.join(' ').toLowerCase();

        if(toList === 'command' || toList === 'cmd' || toList === 'commands' || toList === 'cmds') type = 'commands';
        else if(toList === 'advancements' || message.client.commands.get('advancements').aliases.includes(toList)) type = 'advancements';
        else if(toList === 'stats' || message.client.commands.get('stats').aliases.includes(toList)) type = 'stats';
        else {
            console.log(`${message.member.user.tag} executed /disable list with wrong type in ${message.guild.name}`);
            message.reply(':warning: You can only list `commands`, `stats` or `advancements`.');
            return;
        }

        console.log(`${message.member.user.tag} executed /disable list ${toList} in ${message.guild.name}`);

        const disabled = await settings.getDisabled(message.guildId, type);
        if(disabled.length === 0) {
            message.reply(`<:Checkmark:849224496232660992> There are no disabled ${type}.`);
            return;
        }

        const listEmbed = new Discord.MessageEmbed()
            .setTitle('Disable List')
            .setColor('RED')
            .addField(`===========\n${type.cap()}`, '**===========**');

        for(let disable of disabled) {
            if(type === 'advancements') {
                const matchingTitle = await utils.searchAllAdvancements(disable, true, 1);
                disable = matchingTitle.shift()?.name ?? disable;
            } else if (type === 'stats') disable = disable.split('_').map(word => word.cap()).join(' ');
            else disable = disable.cap();

            listEmbed.addField(disable, '\u200B');
        }

        message.reply({ embeds: [listEmbed] });
    } else {
        let toDisable = args?.join(' ').toLowerCase();

        if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            console.log(`${message.member.user.tag} executed /disable ${type} without admin in ${message.guild.name}`);
            message.reply(':no_entry: This command can only be executed by admins.');
            return;
        }

        if (type === 'command' || type === 'cmd' || type === 'commands' || type === 'cmds') type = 'commands';
        else if (type === 'advancements' || message.client.commands.get('advancements').aliases.includes(type)) type = 'advancements';
        else if (type === 'stats' || message.client.commands.get('stats').aliases.includes(type)) type = 'stats';
        else {
            console.log(`${message.member.user.tag} executed /disable with wrong type in ${message.guild.name}`);
            message.reply(':warning: You can only disable `commands`, `stats` or `advancements`.');
            return;
        }

        //Check for disabled commands
        if(type === 'commands' && disabledCommands.includes(toDisable)) {
            console.log(`${message.member.user.tag} executed /disable ${type} with disabled command ${toDisable} in ${message.guild.name}`);
            message.reply(`:no_entry: You cannot disable this command [**${toDisable}**].`);
            return;
        }

        console.log(`${message.member.user.tag} executed /disable ${type} ${toDisable} in ${message.guild.name}`);

        if(!toDisable) {
            console.log(`${message.member.user.tag} executed /disable ${type} without toDisable in ${message.guild.name}`);
            message.reply(`:warning: Please specify the ${type} you want to disable.`);
            return;
        }

        let formattedToDisable;
        if(type === 'commands') {
            const command = message.client.commands.get(toDisable) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(toDisable));

            if(!command) {
                console.log(`Command [${toDisable}] doesn't exist.`);
                message.reply(`:warning: Command [**${toDisable}**] doesn't exist.`);
                return;
            }

            toDisable = command.name;
            formattedToDisable = toDisable.cap();
        } else if(type === 'advancements') {
            const matchingTitle = await utils.searchAllAdvancements(toDisable, true, 1);
            formattedToDisable = matchingTitle.shift()?.name ?? toDisable.cap();
        } else if(type === 'stats') {
            formattedToDisable = toDisable.split('_').map(word => word.cap()).join(' ');
        }

        if(!await settings.disable(message.guildId, type, toDisable)) {
            console.log(`Could not disable ${toDisable}.`);
            message.reply(`<:Error:849215023264169985> Could not disable ${type} [**${toDisable}**].`);
            return;
        }
        console.log(`Successfully disabled ${type} ${toDisable}.`);
        message.reply(`<:Checkmark:849224496232660992> Successfully disabled ${type} [**${formattedToDisable}**].`);
    }
}

module.exports = { execute, autocomplete };