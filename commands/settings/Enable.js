import utils from '../../api/utils.js';
import { ph } from '../../api/messages.js';
import keys from '../../api/keys';
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
        const settings = client.settingsConnections.cache.get(interaction.guildId);
        if(!settings) return;

        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        const disabled = settings.disabled[subcommand];
        const matchingDisabled = disabled.filter(disable => disable.includes(focused));
        if(matchingDisabled.length >= 25) matchingDisabled.length = 25;

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
            else formattedDisable = disable.cap();

            respondArray.push({
                name: formattedDisable,
                value: disable,
            });
        }

        interaction.respond(respondArray)
            .catch(() => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.command(interaction.command)));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const settings = client.settingsConnections.cache.get(interaction.guildId);

        let type = args?.shift();
        let toEnable = args?.join(' ').toLowerCase();
        const argPlaceholder = { type, 'enable': toEnable };

        let formattedToEnable;
        if(type === 'commands') {
            const command = keys.data[toEnable];

            if(!command) {
                return interaction.replyTl(keys.commands.enable.warnings.command_does_not_exist, argPlaceholder);
            }

            toEnable = command.name;
            formattedToEnable = toEnable.cap();
        }
        else if(type === 'advancements') {
            const matchingTitle = utils.searchAllAdvancements(toEnable, true, true, 1);
            formattedToEnable = matchingTitle.shift()?.name ?? toEnable.cap();

        }
        else if(type === 'stats') {
            formattedToEnable = toEnable.split('_').map(word => word.cap()).join(' ');
        }

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
