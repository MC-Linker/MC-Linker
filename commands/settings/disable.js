const Discord = require('discord.js');
const utils = require('../../api/utils');
const settings = require('../../api/settings');
const { keys, getEmbed, addPh } = require('../../api/messages');

async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    let matchingKeys;
    if(subcommand === 'advancements') {
        matchingKeys = await utils.searchAllAdvancements(focused);
    }
    else if(subcommand === 'stats') {
        matchingKeys = await utils.searchAllStats(focused);
    }

    //Remove all description fields
    matchingKeys.map(title => delete title.description);

    interaction.respond(matchingKeys).catch(() => console.log(keys.commands.disable.errors.could_not_autocomplete.console));
}

async function execute(message, args) {
    let type = args?.shift();

    const disabledCommands = ['enable', 'disable', 'help'];

    if(!type) {
        message.respond(keys.commands.disable.warnings.no_type);
        return;
    }

    if(type === 'list') {
        const toList = args?.join(' ').toLowerCase();

        if(!toList) {
            message.respond(keys.commands.disable.warnings.no_list_type);
            return;
        }
        else if(toList !== 'stats' && toList !== 'advancements' && toList !== 'commands') {
            message.respond(keys.commands.disable.warnings.invalid_type);
            return;
        }

        const disabled = await settings.getDisabled(message.guildId, toList);
        if(disabled.length === 0) {
            message.respond(keys.commands.disable.success.nothing_disabled, { 'type': toList });
            return;
        }

        const listEmbed = getEmbed(keys.commands.disable.success.list.base, { 'type': toList.cap() });

        let counter = 1;
        let listString = '';
        for(let i = 0; i < disabled.length; i++) {
            let disable = disabled[i];

            if(toList === 'advancements') {
                const matchingTitle = await utils.searchAllAdvancements(disable, true, true, 1);
                disable = matchingTitle.shift()?.name ?? disable;
            }
            else if(toList === 'stats') {
                const matchingStat = await utils.searchAllStats(disable, true, true, 1);
                disable = matchingStat.shift()?.name ?? disable;
            }
            else disable = disable.replace('_', ' ').cap();

            listString += `${addPh(keys.commands.disable.success.list.final.embeds[0].fields[0].name, { disable })}\n`;

            //New field for every 25 items
            if(counter % 25 || i === disabled.length - 1) {
                listEmbed.addFields(addPh(keys.commands.disable.success.list.final.embeds[0].fields[0], { disable: listString }));
                listString = '';
            }

            counter++;
        }

        message.replyOptions({ embeds: [listEmbed] });
    }
    else {
        let toDisable = args?.join(' ').toLowerCase();
        const argPlaceholder = { 'disable': toDisable, type };

        if(!message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            message.respond(keys.commands.disable.warnings.no_permission);
            return;
        }
        else if(!toDisable) {
            message.respond(keys.commands.disable.warnings.no_disable, argPlaceholder);
            return;
        }
        else if(type !== 'stats' && type !== 'advancements' && type !== 'commands') {
            message.respond(keys.commands.disable.warnings.invalid_type);
            return;
        }
        else if(type === 'commands' && disabledCommands.includes(toDisable)) {
            message.respond(keys.commands.disable.warnings.disabled_command, argPlaceholder);
            return;
        }

        let formattedToDisable;
        if(type === 'commands') {
            const command = keys.data[toDisable];

            if(!command) {
                message.respond(keys.commands.disable.warnings.command_does_not_exist, argPlaceholder);
                return;
            }

            toDisable = command.name;
            formattedToDisable = toDisable.cap();
        }
        else if(type === 'advancements') {
            const matchingTitle = await utils.searchAllAdvancements(toDisable, true, true, 1);
            formattedToDisable = matchingTitle.shift()?.name ?? toDisable.cap();
        }
        else if(type === 'stats') {
            const matchingStat = await utils.searchAllStats(toDisable, true, true, 1);
            formattedToDisable = matchingStat.shift()?.name ?? toDisable.cap();
        }

        if(!await settings.disable(message.guildId, type, toDisable)) {
            message.respond(keys.commands.disable.errors.could_not_disable, { type, 'disable': formattedToDisable });
            return;
        }

        message.respond(keys.commands.disable.success.disabled, { type, 'disable': formattedToDisable });
    }
}

module.exports = { execute, autocomplete };