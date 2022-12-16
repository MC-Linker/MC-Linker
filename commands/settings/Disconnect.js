import keys from '../../api/keys.js';
import Command from '../../structures/Command.js';
import PluginProtocol from '../../structures/PluginProtocol.js';
import utils from '../../api/utils.js';

export default class Disconnect extends Command {

    constructor() {
        super({
            name: 'disconnect',
            category: 'settings',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const protocol = server.protocol instanceof PluginProtocol ? 'plugin' : 'ftp';
        if(protocol === 'plugin') {
            const disconnect = await server.protocol.disconnect();
            if(!await utils.handleProtocolResponse(disconnect, server.protocol, interaction)) return;
        }

        await client.serverConnections.disconnect(server);
        return interaction.replyTl(keys.commands.disconnect.success, { protocol, protocol_cap: protocol.cap() });
    }
}
