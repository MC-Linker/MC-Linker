const utils = require('../../api/utils');
const { getEmbed, addPh, ph } = require('../../api/messages');
const { keys } = require('../../api/keys');
const AutocompleteCommand = require('../../structures/AutocompleteCommand');

class Disable extends AutocompleteCommand {

    disabledCommands = ['enable', 'disable', 'help'];

    constructor() {
        super({
            name: 'disable',
            requiresConnectedServer: false,
            category: 'settings',
        });
    }

    autocomplete(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        let matchingKeys;
        if(subcommand === 'advancements') matchingKeys = utils.searchAllAdvancements(focused);
        else if(subcommand === 'stats') matchingKeys = utils.searchAllStats(focused);

        interaction.respond(matchingKeys)
            .catch(() => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.command(interaction.command)));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        let settings = server ? server.settings : client.settingsConnections.cache.get(interaction.guildId);
        if(!settings) settings = await client.settingsConnections.connect(interaction.guildId);

        let type = args?.shift();

        if(type === 'list') {
            const toList = args?.join(' ').toLowerCase();

            const disabled = settings.disabled[toList];
            if(!disabled.length) {
                return interaction.replyTl(keys.commands.disable.success.nothing_disabled, { 'type': toList });
            }

            const listEmbed = getEmbed(keys.commands.disable.success.list.base, { 'type': toList.cap() });

            let counter = 1;
            let listString = '';
            for(let i = 0; i < disabled.length; i++) {
                let disable = disabled[i];

                disable = getFormattedName(toList, disable);

                listString += `${addPh(keys.commands.disable.success.list.final.embeds[0].fields[0].name, { disable })}\n`;

                //New field for every 25 items
                if(counter % 25 || i === disabled.length - 1) {
                    listEmbed.addFields(addPh(keys.commands.disable.success.list.final.embeds[0].fields[0], { disable: listString }));
                    listString = '';
                }

                counter++;
            }

            return interaction.replyOptions({ embeds: [listEmbed] });
        }
        else {
            let toDisable = args?.join(' ').toLowerCase();
            const argPlaceholder = { 'disable': toDisable, type };

            if(type === 'commands' && this.disabledCommands.includes(toDisable)) {
                return interaction.replyTl(keys.commands.disable.warnings.disabled_command, argPlaceholder);
            }

            let formattedToDisable = getFormattedName(type, toDisable);
            if(!formattedToDisable) {
                return interaction.replyTl(keys.commands.disable.warnings.command_does_not_exist, argPlaceholder);
            }
            if(type === 'commands') toDisable = formattedToDisable.toLowerCase();

            if(!await settings.disable(type, toDisable)) {
                return interaction.replyTl(keys.commands.disable.errors.could_not_disable, {
                    type,
                    'disable': formattedToDisable,
                });
            }

            return interaction.replyTl(keys.commands.disable.success.disabled, { type, 'disable': formattedToDisable });
        }

        function getFormattedName(type, name) {
            if(type === 'commands') {
                const command = client.commands.get(name);
                if(!command) return;

                return command.name.cap();
            }
            else if(type === 'advancements') {
                const matchingTitle = utils.searchAllAdvancements(name, true, true, 1);
                return matchingTitle.shift()?.name ?? name;
            }
            else if(type === 'stats') {
                const matchingStat = utils.searchAllStats(name, true, true, 1);
                return matchingStat?.shift()?.name ?? name;
            }
            else return name.split('_').map(word => word.cap()).join(' ');
        }
    }
}

module.exports = Disable;
