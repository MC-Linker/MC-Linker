const utils = require('../../api/utils');
const { keys, getEmbed, addPh } = require('../../api/messages');
const AutocompleteCommand = require('../../structures/AutocompleteCommand');

class Disable extends AutocompleteCommand {

    constructor() {
        super({
            name: 'disable',
            requiresConnectedServer: false,
            category: 'settings',
        });
    }

    disabledCommands = ['enable', 'disable', 'help'];

    autocomplete(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        let matchingKeys;
        if(subcommand === 'advancements') matchingKeys = utils.searchAllAdvancements(focused);
        else if(subcommand === 'stats') matchingKeys = utils.searchAllStats(focused);

        interaction.respond(matchingKeys).catch(() => console.log(keys.commands.disable.errors.could_not_autocomplete.console));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        let type = args?.shift();

        if(type === 'list') {
            const toList = args?.join(' ').toLowerCase();

            const disabled = server?.settings?.disabled?.[toList] ?? [];
            if(disabled.length === 0) {
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

            //TODO connect server if not connected
            if(!await server?.settings?.disable(type, toDisable)) {
                return interaction.replyTl(keys.commands.disable.errors.could_not_disable, { type, 'disable': formattedToDisable });
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
