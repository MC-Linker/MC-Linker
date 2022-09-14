const Discord = require('discord.js');
const utils = require('../../api/utils');
const { keys, getEmbed, addPh } = require('../../api/messages');
const AutocompleteCommand = require('../../structures/AutocompleteCommand');

class Disable extends AutocompleteCommand {

    async autocomplete(interaction, client) {
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

    async execute(interaction, client, args) {
        let type = args?.shift();

        const disabledCommands = ['enable', 'disable', 'help'];

        if(!type) {
            interaction.replyTl(keys.commands.disable.warnings.no_type);
            return;
        }

        if(type === 'list') {
            const toList = args?.join(' ').toLowerCase();

            if(!toList) {
                interaction.replyTl(keys.commands.disable.warnings.no_list_type);
                return;
            }
            else if(toList !== 'stats' && toList !== 'advancements' && toList !== 'commands') {
                interaction.replyTl(keys.commands.disable.warnings.invalid_type);
                return;
            }

            const disabled = await settings.getDisabled(interaction.guildId, toList);
            if(disabled.length === 0) {
                interaction.replyTl(keys.commands.disable.success.nothing_disabled, { 'type': toList });
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

            interaction.replyOptions({ embeds: [listEmbed] });
        }
        else {
            let toDisable = args?.join(' ').toLowerCase();
            const argPlaceholder = { 'disable': toDisable, type };

            if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
                interaction.replyTl(keys.commands.disable.warnings.no_permission);
                return;
            }
            else if(!toDisable) {
                interaction.replyTl(keys.commands.disable.warnings.no_disable, argPlaceholder);
                return;
            }
            else if(type !== 'stats' && type !== 'advancements' && type !== 'commands') {
                interaction.replyTl(keys.commands.disable.warnings.invalid_type);
                return;
            }
            else if(type === 'commands' && disabledCommands.includes(toDisable)) {
                interaction.replyTl(keys.commands.disable.warnings.disabled_command, argPlaceholder);
                return;
            }

            let formattedToDisable;
            if(type === 'commands') {
                const command = keys.data[toDisable];

                if(!command) {
                    interaction.replyTl(keys.commands.disable.warnings.command_does_not_exist, argPlaceholder);
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

            if(!await settings.disable(interaction.guildId, type, toDisable)) {
                interaction.replyTl(keys.commands.disable.errors.could_not_disable, { type, 'disable': formattedToDisable });
                return;
            }

            interaction.replyTl(keys.commands.disable.success.disabled, { type, 'disable': formattedToDisable });
        }
    }
}

module.exports = Disable;
