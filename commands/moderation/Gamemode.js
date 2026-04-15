import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Gamemode extends Command {

    constructor() {
        super({
            name: 'gamemode',
            requiresUserIndex: 0,
            category: 'moderation',
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse, string]} args - [0] The resolved user, [1] The gamemode to set.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const user = args[0];
        const userConnection = client.userConnections.cache.get(interaction.user.id);
        const gamemode = args[1];

        const resp = await server.protocol.execute(`gamemode ${gamemode} ${user.username}`, userConnection?.getUUID(server));
        if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

        //TODO show response message in embed
        const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
        return interaction.editReplyTl(keys.commands.gamemode.success, {
            username: user.username,
            gamemode: utils.toTitleCase(gamemode),
            warning,
        });
    }
}
