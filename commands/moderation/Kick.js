import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';
import { codeBlockFromCommandResponse } from '../../utilities/utils.js';

export default class Kick extends Command {

    constructor() {
        super({
            name: 'kick',
            requiresUserIndex: 0,
            category: 'moderation',
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse, ...string]} args - [0] The resolved user, [1+] The kick reason words.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const user = args[0];
        const userConnection = client.userConnections.cache.get(interaction.user.id);
        args.shift(); //Shift user
        const reason = args[0] ? args.join(' ') : 'Kicked by an operator.';

        const resp = await server.protocol.execute(`kick ${user.username} ${reason}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const response = resp.data?.message
            ? codeBlockFromCommandResponse(resp.data.message)
            : keys.api.plugin.warnings.no_response_message_short;
        return interaction.editReplyTl(keys.commands.kick.success, { username: user.username, reason, response });
    }
}
