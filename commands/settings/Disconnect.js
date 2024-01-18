import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';

export default class Disconnect extends Command {

    constructor() {
        super({
            name: 'disconnect',
            category: 'settings',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        let protocol;
        if(server.protocol.isPluginProtocol()) {
            protocol = 'plugin';
            const disconnect = await server.protocol.disconnect();
            if(!await utils.handleProtocolResponse(disconnect, server.protocol, interaction)) return;
        }
        else if(server.protocol.isFtpProtocol()) protocol = 'ftp';

        await client.serverConnections.disconnect(server);
        return interaction.replyTl(keys.commands.disconnect.success, { protocol, protocol_cap: protocol.cap() });
    }
}
