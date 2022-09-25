const Discord = require('discord.js');
const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');
const PluginProtocol = require('../../structures/PluginProtocol');

class Ban extends Command {

    constructor() {
        super('ban');
    }

    async execute(interaction, client, args, server) {
        if(!server) {
            return interaction.replyTl(keys.api.connections.errors.server_not_connected);
        }
        else if(!(server.protocol instanceof PluginProtocol)) {
            return interaction.replyTl(keys.api.utils.errors.not_connected_with_plugin);
        }

        const user = await client.userConnections.playerFromArgument(args[0], server);
        args.shift(); // Shift user
        let reason = args[0] ? args.join(' ') : 'Banned by an operator.';

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.BanMembers)) {
            await interaction.replyTl(keys.commands.ban.warnings.no_permission);
            return;
        }
        else if(user.error === 'nullish') {
            return interaction.replyTl(keys.commands.ban.warnings.no_username);
        }
        else if(user.error === 'cache') {
            return interaction.replyTl(keys.api.connections.errors.user_not_connected);
        }
        else if(user.error === 'fetch') {
            return interaction.replyTl(keys.api.utils.errors.could_not_fetch_uuid);
        }

        const resp = await server.protocol.execute(`ban ${user.username} ${reason}`);
        if(!resp) {
            return interaction.replyTl(keys.api.plugin.errors.no_response);
        }
        else if(resp.status === 206) {
            return interaction.replyTl(keys.commands.ban.warnings.response_warning, {
                username: user,
                reason,
            });
        }
        else {
            return interaction.replyTl(keys.commands.ban.success, { username: user, reason });
        }
    }
}

module.exports = Ban;
