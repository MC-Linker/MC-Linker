const { keys } = require('../../api/keys');
const Command = require('../../structures/Command');
const utils = require('../../api/utils');

// noinspection JSClassNamingConvention
class Op extends Command {

    constructor() {
        super({
            name: 'op',
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];

        const resp = await server.protocol.execute(`op ${user.username}`);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.op.success, { username: user.username, warning });
    }
}

module.exports = Op;


