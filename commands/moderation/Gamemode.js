const { keys } = require('../../api/keys');
const Command = require('../../structures/Command');
const utils = require('../../api/utils');

class Gamemode extends Command {

    constructor() {
        super({
            name: 'gamemode',
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
            category: 'moderation',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];
        const gamemode = args[1];

        const resp = await server.protocol.execute(`gamemode ${gamemode} ${user.username}`);
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.replyTl(keys.commands.gamemode.success, {
            username: user.username,
            gamemode: gamemode.cap(),
            warning,
        });
    }
}

module.exports = Gamemode;
