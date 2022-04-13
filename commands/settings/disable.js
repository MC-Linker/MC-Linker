const Discord = require('discord.js');
const fs = require('fs');
const utils = require('../../api/utils');
const settings = require('../../api/settings');
const { keys, getEmbedBuilder, addPh} = require('../../api/messages');

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
                    interaction.respond(respondArray).catch(() => console.log(keys.commands.disable.errors.could_not_autocomplete));
                }
            });
        });
    }
}

async function execute(message, args) {
    let type = args?.shift();

    const disabledCommands = ['enable', 'disable', 'help'];

    if(!type) {
        message.respond(keys.commands.disable.warnings.no_type);
        return;
    }

    if (type === 'list') {
        const toList = args?.join(' ').toLowerCase();

        if(toList !== 'stats' || toList !== 'advancements' || toList !== 'commands') {
            message.respond(keys.commands.disable.warnings.invalid_type);
            return;
        }

        console.log(`${message.member.user.tag} executed /disable list ${toList} in ${message.guild.name}`);

        const disabled = await settings.getDisabled(message.guildId, type);
        if(disabled.length === 0) {
            message.respond(keys.commands.disable.success.nothing_disabled);
            return;
        }

        const listEmbed = getEmbedBuilder(keys.commands.disable.success.list.base, { type });

        for(let disable of disabled) {
            if(type === 'advancements') {
                const matchingTitle = await utils.searchAllAdvancements(disable, true, 1);
                disable = matchingTitle.shift()?.name ?? disable;
            } else if (type === 'stats') disable = disable.split('_').map(word => word.cap()).join(' ');
            else disable = disable.cap();

            listEmbed.addField(
                addPh(keys.commands.disable.success.list.final.fields.disabled.title, { disable }),
                keys.commands.disable.success.list.final.fields.disabled.content
            );
        }

        message.replyOptions({ embeds: [listEmbed] });
    } else {
        let toDisable = args?.join(' ').toLowerCase();
        const argPlaceholder = { "disable": toDisable, type };

        if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            message.respond(keys.commands.disable.warnings.no_permission);
            return;
        }

        if(toDisable !== 'stats' || toDisable !== 'advancements' || toDisable !== 'commands') {
            message.respond(keys.commands.disable.warnings.invalid_type);
            return;
        }

        //Check for disabled commands
        if(type === 'commands' && disabledCommands.includes(toDisable)) {
            message.respond(keys.commands.disable.warnings.disabled_command, argPlaceholder);
            return;
        }

        if(!toDisable) {
            message.respond(keys.commands.disable.warnings.no_disable, argPlaceholder);
            return;
        }

        let formattedToDisable;
        if(type === 'commands') {
            const command = message.client.commands.get(toDisable);

            if(!command) {
                message.respond(keys.commands.disable.warnings.command_does_not_exist, argPlaceholder);
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
            message.respond(keys.commands.disable.errors.could_not_disable, { type, "disable": formattedToDisable });
            return;
        }

        message.respond(keys.commands.disable.success.disabled, { type, "disable": formattedToDisable });
    }
}

module.exports = { execute, autocomplete };