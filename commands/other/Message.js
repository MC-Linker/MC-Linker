const { keys } = require('../../api/keys');
const Command = require('../../structures/Command');
const utils = require('../../api/utils');

class Message extends Command {

    constructor() {
        super({
            name: 'message',
            ephemeral: true,
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
            category: 'other',
        });
    }


    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];
        args.shift(); //Remove username from args
        const chatMsg = args?.join(' ').replaceAll(`"`, `\\"`);
        const argPlaceholder = { username: user.username, 'message': chatMsg };

        const resp = await server.protocol.chatPrivate(chatMsg, interaction.member.nickname ?? interaction.member.user.username, user.username);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.message.success, argPlaceholder, { warning });
    }
}

module.exports = Message;
