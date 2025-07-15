import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Kick extends Command {

    constructor() {
        super({
            name: 'kick',
            requiresUserIndex: 0,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];
        const userConnection = await client.userConnections.cache.get(interaction.user.id);
        args.shift(); //Shift user
        const reason = args[0] ? args.join(' ') : 'Kicked by an operator.';

        const resp = await server.protocol.execute(`kick ${user.username} ${reason}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.kick.success, { username: user.username, reason, warning });
    }
}
