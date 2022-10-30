const { keys } = require('../../api/keys');
const Command = require('../../structures/Command');
const PluginProtocol = require('../../structures/PluginProtocol');
const utils = require('../../api/utils');

class Disconnect extends Command {

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

module.exports = Disconnect;
