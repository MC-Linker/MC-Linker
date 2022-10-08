const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

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
        if(!resp) {
            return interaction.replyTl(keys.api.plugin.errors.no_response);
        }

        if(resp.status === 206) return interaction.replyTl(keys.commands.op.warnings.response_warning, { username: user });
        else return interaction.replyTl(keys.commands.op.success, { username: user });
    }
}

module.exports = Op;


