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

        const method = args[0];

        const protocol = server.protocol instanceof PluginProtocol ? 'plugin' : 'ftp';
        if(protocol === 'plugin' && method === 'ftp') {
            return interaction.replyTl(keys.api.command.errors.server_not_connected_ftp);
        }
        else if(protocol === 'ftp' && method === 'plugin') {
            return interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);
        }

        if(method === 'plugin') {
            const disconnect = await server.protocol.disconnect();
            if(!await utils.handleProtocolResponse(disconnect, server.protocol, interaction)) return;
        }

        await client.serverConnections.disconnect(server);
        return interaction.replyTl(keys.commands.disconnect.success, { method, method_cap: method.cap() });
    }
}

module.exports = Disconnect;
