const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');
const utils = require('../../api/utils');

class Kick extends Command {

    constructor() {
        super({
            name: 'kick',
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];
        args.shift(); //Shift user
        let reason = args[0] ? args.join(' ') : 'Kicked by an operator.';

        const resp = await server.protocol.execute(`kick ${user.username} ${reason}`);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        if(resp.status === 206) {
            return interaction.replyTl(keys.commands.kick.warnings.response_warning, {
                username: user,
                reason,
            });
        }
        else return interaction.replyTl(keys.commands.kick.success, { username: user, reason });
    }
}

module.exports = Kick;


