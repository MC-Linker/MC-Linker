import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { codeBlockFromCommandResponse } from '../../utilities/utils.js';
import AutocompleteCommand from '../../structures/AutocompleteCommand.js';

export default class Command extends AutocompleteCommand {

    constructor() {
        super({
            name: 'command',
            category: 'moderation',
            ephemeral: true,
        });
    }

    async autocomplete(interaction, client) {
        return this.autocompleteFromCommandCompletions(interaction, client);
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const selectedValue = args.join(' ').trim();
        const commandInput = this.resolveAutocompleteValue(selectedValue, interaction);
        if(commandInput === null) return interaction.replyTl(keys.commands.command.warnings.autocomplete_selection_expired);

        let command = this.replaceMentionsWithUsernames(commandInput, interaction, client);
        if(command === null) return;
        if(command.startsWith('/')) command = command.slice(1);

        const userConnection = client.userConnections.cache.get(interaction.user.id);
        const resp = await server.protocol.execute(command, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        let respMessage = resp.status === 'success' ? resp.data.message : keys.api.plugin.warnings.no_response_message;
        respMessage = codeBlockFromCommandResponse(respMessage);

        return interaction.replyTl(keys.commands.command.success, { 'response': respMessage });
    }

    replaceMentionsWithUsernames(commandInput, interaction, client) {
        let command = commandInput;

        if(/(^|\s)@s(?=\s|$)/.test(command)) {
            const selfUsername = client.userConnections.cache.get(interaction.user.id)?.username;
            if(!selfUsername) return null;

            command = command.replace(/(^|\s)@s(?=\s|$)/g, `$1${selfUsername}`);
        }

        const mentionIds = [...command.matchAll(/<@!?(\d+)>/g)].map(match => match[1]);
        if(mentionIds.length === 0) return command;

        for(const userId of new Set(mentionIds)) {
            const username = client.userConnections.cache.get(userId)?.username;
            if(!username) return null;

            command = command.replace(new RegExp(`<@!?${userId}>`, 'g'), username);
        }

        return command;
    }
}
