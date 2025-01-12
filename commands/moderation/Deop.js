import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Deop extends Command {

    constructor() {
        super({
            name: 'deop',
            requiresConnectedPlugin: true,
            userIndex: 0,
            serverIndex: 1,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, serverConnection) {
        if(!await super.execute(interaction, client, args, serverConnection)) return;

        const user = args[0];
        const server = args[1];
        const userConnection = await client.userConnections.cache.get(interaction.user.id);

        const resp = await server.protocol.execute(`deop ${user.username}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.deop.success, { username: user.username, warning });
    }
}
