import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Message extends Command {

    constructor() {
        super({
            name: 'message',
            ephemeral: true,
            requiresUserIndex: 0,
            category: 'other',
        });
    }


    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse, ...string]} args - [0] The resolved user, [1+] The message words.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {

        const user = args[0];
        args.shift(); //Remove username from args
        const chatMsg = utils.cleanEmojis(args?.join(' ').replaceAll(`"`, `\\"`));
        const argPlaceholder = { username: user.username, 'message': chatMsg };

        const resp = await server.protocol.chatPrivate(chatMsg, interaction.member.nickname ?? interaction.member.user.username, user.username);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.editReplyTl(keys.commands.message.success, argPlaceholder, { warning });
    }
}
