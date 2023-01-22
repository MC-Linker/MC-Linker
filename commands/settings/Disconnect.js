import keys from '../../api/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../api/utils.js';

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
        if(server.hasHttpProtocol()) protocol = 'plugin';
        else if(server.hasWebSocketProtocol()) protocol = 'websocket';
        else if(server.hasFtpProtocol()) protocol = 'ftp';

        if(protocol === 'plugin' || protocol === 'websocket') {
            const disconnect = await server.protocol.disconnect();
            if(!await utils.handleProtocolResponse(disconnect, server.protocol, interaction)) return;
        }

        await client.serverConnections.disconnect(server);
        return interaction.replyTl(keys.commands.disconnect.success, { protocol, protocol_cap: protocol.cap() });
    }
}
