const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

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
        if(!resp) {
            return interaction.replyTl(keys.api.plugin.errors.no_response);
        }

        if(resp.status === 206) {
            return interaction.replyTl(keys.commands.gamemode.warnings.response_warning, {
                username: user,
                gamemode: gamemode.cap(),
            });
        }
        else return interaction.replyTl(keys.commands.gamemode.success, { username: user, gamemode: gamemode.cap() });
    }
}

module.exports = Gamemode;
