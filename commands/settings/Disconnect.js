import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';

export default class Disconnect extends Command {

    constructor() {
        super({
            name: 'disconnect',
            category: 'settings',
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[]} args - No arguments.
     * @param {ServerConnection} server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        await client.serverConnections.disconnect(server);
        return interaction.editReplyTl(keys.commands.disconnect.success);
    }
}
