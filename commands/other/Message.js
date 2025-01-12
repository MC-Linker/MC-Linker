import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Message extends Command {

    constructor() {
        super({
            name: 'message',
            ephemeral: true,
            requiresConnectedPlugin: true,
            userIndex: 0,
            serverIndex: 2,
            category: 'other',
        });
    }


    async execute(interaction, client, args, serverConnection) {
        if(!await super.execute(interaction, client, args, serverConnection)) return;

        const user = args[0];
        const chatMsg = utils.cleanEmojis(args[1].replaceAll(`"`, `\\"`));
        const server = args[2];
        const argPlaceholder = { username: user.username, 'message': chatMsg };

        const resp = await server.protocol.chatPrivate(chatMsg, interaction.member.nickname ?? interaction.member.user.username, user.username);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.message.success, argPlaceholder, { warning });
    }
}
