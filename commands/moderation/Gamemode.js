import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Gamemode extends Command {

    constructor() {
        super({
            name: 'gamemode',
            requiresConnectedPlugin: true,
            requiresUserIndex: 0,
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
