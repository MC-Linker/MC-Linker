import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Unban extends Command {

    constructor() {
        super({
            name: 'unban',
            requiresUserIndex: 0,
            category: 'moderation',
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse]} args - [0] The resolved user to unban.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const user = args[0];
        const userConnection = await client.userConnections.cache.get(interaction.user.id);

        const resp = await server.protocol.execute(`pardon ${user.username}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        //TODO show response message in embed
        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.editReplyTl(keys.commands.unban.success, { username: user.username, warning });
    }
}
