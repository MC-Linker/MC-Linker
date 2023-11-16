import * as utils from '../../utilities/utils.js';
import { MaxAutoCompleteChoices } from '../../utilities/utils.js';
import { addPh, getEmbed, ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import commands from '../../resources/data/commands.json' assert { type: 'json' };

const commandNames = Object.keys(commands);

export default class Disable extends AutocompleteCommand {

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

        let matchingKeys = [];
        if(subcommand === 'advancements') matchingKeys = utils.searchAllAdvancements(focused);
        else if(subcommand === 'stats') matchingKeys = utils.searchAllStats(focused);
        else if(subcommand === 'chat-commands') {
            for(const name of commandNames) {
                if(!name.includes(focused)) continue;

                matchingKeys.push({
                    name,
                    value: name,
                });
            }

            if(matchingKeys.length > MaxAutoCompleteChoices) matchingKeys.length = 25;
        }

        interaction.respond(matchingKeys)
            .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.interaction(interaction), ph.error(err)));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const settings = await client.serverSettingsConnections.getOrConnect(interaction.guildId);
        const type = args.shift()
            .replace('chat-commands', 'chatCommands');

        if(type === 'list') {
            const toList = args[1];

            const disabled = settings.disabled[toList];
            if(!disabled?.length) {
                return interaction.replyTl(keys.commands.disable.success.nothing_disabled, { 'type': toList });
            }

            const listEmbed = getEmbed(keys.commands.disable.success.list.base, { 'type': toList.cap() }, ph.emojisAndColors());

            let listString = '';
            for(let i = 0; i < disabled.length; i++) {
                let disable = disabled[i];

                disable = getFormattedName(toList, disable);

                listString += `${addPh(keys.commands.disable.success.list.entry, { disable })}\n`;

                //New field for every 25 items
                if((i + 1) % 25 === 0 || i === disabled.length - 1) {
                    listEmbed.addFields(addPh(keys.commands.disable.success.list.final.embeds[0].fields[0], { list: listString }));
                    listString = '';
                }
            }

            return interaction.replyOptions({ embeds: [listEmbed] });
        }
        else {
            const toDisable = args.join(' ').toLowerCase();
            const argPlaceholder = { disable: toDisable, type };

            const formattedToDisable = getFormattedName(type, toDisable);
            if(!formattedToDisable) {
                return interaction.replyTl(keys.commands.disable.warnings.command_does_not_exist, argPlaceholder);
            }

            if(!await settings.disable(type, toDisable)) {
                return interaction.replyTl(keys.commands.disable.errors.could_not_disable, {
                    type,
                    'disable': formattedToDisable,
                });
            }

            return interaction.replyTl(keys.commands.disable.success.disabled, { type, 'disable': formattedToDisable });
        }

        function getFormattedName(type, name) {
            if(type === 'advancements') {
                const matchingTitle = utils.searchAllAdvancements(name, true, true, 1);
                return matchingTitle.shift()?.name ?? name;
            }
            else if(type === 'stats') {
                const matchingStat = utils.searchAllStats(name, true, true, 1);
                return matchingStat?.shift()?.name ?? name;
            }

            return name;
        }
    }
}
