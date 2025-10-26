import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';

export default class Disconnect extends Command {

    constructor() {
        super({
            name: 'disconnect',
            category: 'settings',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        await client.serverConnections.disconnect(server);
        return interaction.replyTl(keys.commands.disconnect.success);
    }
}
