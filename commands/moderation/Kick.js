import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Kick extends Command {

    constructor() {
        super({
            name: 'kick',
            requiresConnectedPlugin: true,
            userIndex: 0,
            serverIndex: 2,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, serverConnection) {
        if(!await super.execute(interaction, client, args, serverConnection)) return;

        const user = args[0];
        const userConnection = await client.userConnections.cache.get(interaction.user.id);
        const reason = args[1] ?? 'Kicked by an operator.';
        const server = args[2];

        const resp = await server.protocol.execute(`kick ${user.username} ${reason}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.kick.success, { username: user.username, reason, warning });
    }
}
