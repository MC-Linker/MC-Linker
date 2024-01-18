import * as utils from '../../utilities/utils.js';
import { MaxAutoCompleteChoices } from '../../utilities/utils.js';
import { ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import AutocompleteCommand from '../../structures/AutocompleteCommand.js';

export default class Enable extends AutocompleteCommand {

    constructor() {
        super({
            name: 'enable',
            category: 'settings',
            requiresConnectedServer: false,
        });
    }

    autocomplete(interaction, client) {
        const settings = client.serverSettingsConnections.cache.get(interaction.guildId);
        if(!settings) return;

        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        const disabled = settings.disabled[subcommand];
        if(!disabled) return;
        const matchingDisabled = disabled.filter(disable => disable.includes(focused));
        if(matchingDisabled.length > MaxAutoCompleteChoices) matchingDisabled.length = 25;

        const respondArray = [];
        for(let disable of matchingDisabled) {
            disable = disable.replaceAll(`${interaction.guildId}_`, '');

            let formattedDisable;
            if(subcommand === 'advancements') {
                const matchingTitle = utils.searchAllAdvancements(disable, true, true, 1);
                formattedDisable = matchingTitle.shift()?.name ?? disable.cap();

            }
            else if(subcommand === 'stats') {
                const matchingStat = utils.searchAllStats(disable, true, true, 1);
                formattedDisable = matchingStat.shift()?.name ?? disable.cap();
            }
            else formattedDisable = disable;

            respondArray.push({
                name: formattedDisable,
                value: disable,
            });
        }

        interaction.respond(respondArray)
            .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.interaction(interaction), ph.error(err)));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const type = args?.shift();
        let toEnable = args?.join(' ').toLowerCase();
        const argPlaceholder = { type, 'enable': toEnable };

        const settings = client.serverSettingsConnections.cache.get(interaction.guildId);
        if(!settings) {
            return interaction.replyTl(keys.commands.enable.warnings.already_enabled, argPlaceholder);
        }

        let formattedToEnable;
        if(type === 'advancements') {
            const matchingTitle = utils.searchAllAdvancements(toEnable, true, true, 1);
            formattedToEnable = matchingTitle.shift()?.name ?? toEnable.cap();

        }
        else if(type === 'stats') {
            formattedToEnable = toEnable.split('_').map(word => word.cap()).join(' ');
        }
        else formattedToEnable = toEnable;

        if(!settings?.isDisabled(type, toEnable)) {
            return interaction.replyTl(keys.commands.enable.warnings.already_enabled, {
                'type': type.cap(),
                'enable': formattedToEnable,
            });
        }

        await settings.enable(type, toEnable);
        return interaction.replyTl(keys.commands.enable.success, { type, 'enable': formattedToEnable });
    }
}
