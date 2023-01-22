import keys from '../../api/keys.js';
import Command from '../../structures/Command.js';
import PluginProtocol from '../../structures/PluginProtocol.js';
import * as utils from '../../api/utils.js';
import WebSocketProtocol from '../../structures/WebSocketProtocol.js';
import FtpProtocol from '../../structures/FtpProtocol.js';

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
        if(server.protocol instanceof PluginProtocol) protocol = 'plugin';
        else if(server.protocol instanceof WebSocketProtocol) protocol = 'websocket';
        else if(server.protocol instanceof FtpProtocol) protocol = 'ftp';

        if(protocol === 'plugin' || protocol === 'websocket') {
            const disconnect = await server.protocol.disconnect();
            if(!await utils.handleProtocolResponse(disconnect, server.protocol, interaction)) return;
        }

        await client.serverConnections.disconnect(server);
        return interaction.replyTl(keys.commands.disconnect.success, { protocol, protocol_cap: protocol.cap() });
    }
}
