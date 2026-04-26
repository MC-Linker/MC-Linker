import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';
import { codeBlockFromCommandResponse } from '../../utilities/utils.js';

export default class Op extends Command {

    constructor() {
        super({
            name: 'op',
            requiresUserIndex: 0,
            category: 'moderation',
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse]} args - [0] The resolved user to op.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const user = args[0];
        const userConnection = client.userConnections.cache.get(interaction.user.id);

        const resp = await server.protocol.execute(`op ${user.username}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const response = resp.data?.message
            ? codeBlockFromCommandResponse(resp.data.message)
            : keys.api.plugin.warnings.no_response_message_short;
        return interaction.editReplyTl(keys.commands.op.success, { username: user.username, response });
    }
}
