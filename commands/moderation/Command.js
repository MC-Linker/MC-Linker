import { ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { codeBlockFromCommandResponse, MaxAutoCompleteChoices } from '../../utilities/utils.js';
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
        const focused = interaction.options.getFocused();
        const server = client.serverConnections.cache.get(interaction.guildId);

        if(!server) {
            return interaction.respond([])
                .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
        }

        const userConnection = client.userConnections.cache.get(interaction.user.id);
        const response = await server.protocol.commandCompletions(focused, userConnection?.getUUID(server));

        if(response?.status !== 'success') {
            return interaction.respond([])
                .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
        }

        const respondArray = this.normalizeCompletions(response.data, focused);
        if(respondArray.length > MaxAutoCompleteChoices) respondArray.length = MaxAutoCompleteChoices;

        return interaction.respond(respondArray)
            .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const commandInput = args.join(' ').trim();
        const command = this.replaceMentionsWithUsernames(commandInput, interaction, client);
        if(command === null) return;

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

    normalizeCompletions(data, focused) {
        const rawCompletions = Array.isArray(data) ? data : [];

        // Remove the last word (respecting brackets and braces) as it will be replaced by completion
        const focusedWithoutLastWord = focused.replace(/[^\[\]\s{}=,]+$/gm, '');
        return rawCompletions.map(completion => {
            const value = !/[,\]}]/.test(completion) ?
                `${focusedWithoutLastWord}${completion}` :
                `${focused}${completion}`;
            return { name: value, value };
        });
    }
}
