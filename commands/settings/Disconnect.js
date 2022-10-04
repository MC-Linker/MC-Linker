const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');
const PluginProtocol = require('../../structures/PluginProtocol');

class Disconnect extends Command {

    constructor() {
        super({
            name: 'disconnect',
        });
    }


    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const method = args[0];

        if(method === 'plugin' || method === 'ftp') {
            const protocol = server.protocol instanceof PluginProtocol ? 'plugin' : 'ftp';

            if(protocol !== method) {
                return interaction.replyTl(keys.commands.disconnect.warnings.invalid_protocol, { method });
            }

            if(method === 'plugin') {
                const disconnect = await server.protocol.disconnect();
                if(!disconnect) {
                    return interaction.replyTl(keys.api.plugin.errors.no_response);
                }
            }

            await client.serverConnections.disconnect(server);
        }
        else await client.userConnections.disconnect(interaction.user.id);

        return interaction.replyTl(keys.commands.disconnect.success, { method });
    }
}

module.exports = Disconnect;
