import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Ban extends Command {

    constructor() {
        super({
            name: 'ban',
            requiresUserIndex: 0,
            category: 'moderation',
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse, ...string]} args - [0] The resolved user, [1+] The ban reason words.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const user = args[0];
        const userConnection = await client.userConnections.cache.get(interaction.user.id);

        args.shift(); // Shift user
        const reason = args[0] ? args.join(' ') : 'Banned by an operator.';

        const resp = await server.protocol.execute(`ban ${user.username} ${reason}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.editReplyTl(keys.commands.ban.success, { username: user.username, reason, warning });
    }
}
