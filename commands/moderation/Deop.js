const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

class Deop extends Command {

    constructor() {
        super({
            name: 'deop',
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];

        const resp = await server.protocol.execute(`deop ${user.username}`);
        if(!resp) {
            return interaction.replyTl(keys.api.plugin.errors.no_response);
        }

        if(resp.status === 206) return interaction.replyTl(keys.commands.deop.warnings.response_warning, { username: user });
        return interaction.replyTl(keys.commands.deop.success, { username: user });
    }
}

module.exports = Deop;
