import keys from '../../api/keys.js';
import Command from '../../structures/Command.js';
import utils from '../../api/utils.js';

export default class Ban extends Command {

    constructor() {
        super({
            name: 'ban',
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];
        args.shift(); // Shift user
        let reason = args[0] ? args.join(' ') : 'Banned by an operator.';

        const resp = await server.protocol.execute(`ban ${user.username} ${reason}`);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.ban.success, { username: user.username, reason, warning });
    }
}
