const utils = require('../../api/utils');
const settings = require('../../api/settings');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    const disabled = await settings.getDisabled(interaction.guildId, subcommand);
    const matchingDisabled = disabled.filter(disable => disable.includes(focused));
    if(matchingDisabled.length >= 25) matchingDisabled.length = 25;

    const respondArray = [];
    for(let disable of matchingDisabled) {
        disable = disable.replaceAll(`${interaction.guildId}_`, '');
        let formattedDisable;

        if(subcommand === 'advancements') {
            const matchingTitle = await utils.searchAllAdvancements(disable, true, true, 1);
            formattedDisable = matchingTitle.shift()?.name ?? disable.cap();

        }
        else if(subcommand === 'stats') {
            const matchingStat = await utils.searchAllStats(disable, true, true, 1);
            formattedDisable = matchingStat.shift()?.name ?? disable.cap();
        }
        else formattedDisable = disable.cap();

        respondArray.push({
            name: formattedDisable,
            value: disable,
        });
    }

    interaction.respond(respondArray).catch(() => console.log(keys.commands.enable.errors.could_not_autocomplete));
}

async function execute(message, args) {
    let type = args?.shift();
    let toEnable = args?.join(' ').toLowerCase();
    const argPlaceholder = { type, 'enable': toEnable };

    if(!message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
        message.respond(keys.commands.enable.warnings.no_permission);
        return;
    }
    else if(!type) {
        message.respond(keys.commands.enable.warnings.no_type);
        return;
    }
    else if(!toEnable) {
        message.respond(keys.commands.enable.warnings.no_enable);
        return;
    }
    else if(type !== 'stats' && type !== 'advancements' && type !== 'commands') {
        message.respond(keys.commands.enable.warnings.invalid_type);
        return;
    }

    let formattedToEnable;
    if(type === 'commands') {
        const command = keys.data[toEnable];

        if(!command) {
            message.respond(keys.commands.enable.warnings.command_does_not_exist, argPlaceholder);
            return;
        }

        toEnable = command.name;
        formattedToEnable = toEnable.cap();

    }
    else if(type === 'advancements') {
        const matchingTitle = await utils.searchAllAdvancements(toEnable, true, true, 1);
        formattedToEnable = matchingTitle.shift()?.name ?? toEnable.cap();

    }
    else if(type === 'stats') {
        formattedToEnable = toEnable.split('_').map(word => word.cap()).join(' ');
    }

    if(!await settings.enable(message.guildId, type, toEnable)) {
        message.respond(keys.commands.enable.warnings.already_enabled, {
            'type': type.cap(),
            'enable': formattedToEnable,
        });
        return;
    }

    message.respond(keys.commands.enable.success, { type, 'enable': formattedToEnable });
}

module.exports = { execute, autocomplete };