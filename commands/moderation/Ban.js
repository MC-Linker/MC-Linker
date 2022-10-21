const { keys } = require('../../api/keys');
const Command = require('../../structures/Command');
const utils = require('../../api/utils');

class Ban extends Command {

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
        if(resp.status === 206) {
            return interaction.replyTl(keys.commands.ban.warnings.response_warning, { username: user, reason });
        }

        return interaction.replyTl(keys.commands.ban.success, { username: user, reason });
    }
}

module.exports = Ban;
