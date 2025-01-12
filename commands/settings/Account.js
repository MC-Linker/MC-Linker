import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import Discord from 'discord.js';
import crypto from 'crypto';
import { ph } from '../../utilities/messages.js';

export default class Account extends Command {

    /**
     * Map of users awaiting account verification from `/verify`.
     * The key is the verification code.
     * @type {Map<string, { user: UserConnectionData, timeout: number, serverConnection: ServerConnection }>}
     */
    usersAwaitingCommandVerification = new Map();

    constructor() {
        super({
            name: 'account',
            category: 'settings',
            requiresConnectedServer: false,
            ephemeral: true,
        });
    }

    async execute(interaction, client, args, serverConnection) {
        if(!await super.execute(interaction, client, args, serverConnection)) return;

        const subcommand = args[0];
        if(subcommand === 'connect') {
            const username = args[1];
            if(username.match(Discord.MessageMentions.UsersPattern))
                return interaction.replyTl(keys.commands.account.warnings.mention);

            const code = crypto.randomBytes(16).toString('hex').slice(0, 5);

            const successIPs = [];
            let user;
            if(!serverConnection.servers.length) return await interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);

            // Send errors to interaction when there's only one server
            if(serverConnection.servers.length === 1) {
                const server = serverConnection.servers[0];
                if(!server.protocol.isPluginProtocol()) return await interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);
                const {
                    error,
                    username,
                    uuid,
                } = await client.userConnections.userFromArgument(args[1], server, interaction);
                if(error) return;

                const verifyResponse = await server.protocol.verifyUser(code, uuid);
                if(!await utils.handleProtocolResponse(verifyResponse, server.protocol, interaction)) return;
                user = { username, uuid, id: interaction.user.id };
                successIPs.push(server.displayIp ?? server.ip);
            }
            else {
                for(const server of serverConnection.servers) {
                    if(!server.protocol.isPluginProtocol()) continue;

                    const {
                        error,
                        username,
                        uuid,
                    } = await client.userConnections.userFromArgument(args[1], server, null);
                    if(error) continue;

                    const verifyResponse = await server.protocol.verifyUser(code, uuid);
                    if(!await utils.handleProtocolResponse(verifyResponse, server.protocol, null)) continue;
                    user = { username, uuid, id: interaction.user.id };
                    successIPs.push(server.displayIp ?? server.ip);
                }
                // Generalize errors for multiple servers
                if(!successIPs.length) return await interaction.replyTl(keys.commands.account.errors.unknown_error);
            }

            await interaction.replyTl(keys.commands.account.step.verification_info, {
                code,
                ip: successIPs.join('**/**'),
            }, ph.emojisAndColors());

            const timeout = setTimeout(async () => {
                await interaction.replyTl(keys.commands.account.warnings.verification_timeout);
            }, 180_000);

            this.usersAwaitingCommandVerification.set(code, {
                user,
                timeout,
                serverConnection,
            });
        }
        else if(subcommand === 'disconnect') {
            const connection = client.userConnections.cache.get(interaction.user.id);
            if(!connection) return interaction.replyTl(keys.commands.account.warnings.not_connected);

            const settings = await client.userSettingsConnections.cache.get(interaction.user.id);
            if(settings) await settings.updateRoleConnection(connection.username, {
                'connectedaccount': 0,
            });

            await client.userConnections.disconnect(interaction.user.id);

            for(const server of serverConnection.servers) {
                if(server.protocol.isPluginProtocol() && server.requiredRoleToJoin)
                    await server.protocol.execute(`kick ${connection.username} §cYou have been disconnected from your account.`);
            }
            await interaction.replyTl(keys.commands.disconnect.success, {
                protocol: 'account',
                protocol_cap: 'Account',
            });
        }
    }


    /**
     * Gets called when a user verifies their account
     * @param {MCLinker} client
     * @param {object} data
     * @param {string} data.code
     */
    async verifyResponse(client, data) {
        await client.shard.broadcastEval(async (c, { data }) => {
            const verificationData = c.commands.get('account').usersAwaitingCommandVerification.get(data.code);
            if(!verificationData) return;

            const connection = await client.userConnections.connect(verificationData.user);

            const settings = client.userSettingsConnections.cache.get(verificationData.user.id);
            if(settings) await settings.updateRoleConnection(verificationData.user.username, {
                'connectedaccount': 1,
            });

            const guild = await client.guilds.fetch(verificationData.serverConnection.id);
            const member = await guild.members.fetch(verificationData.user.id);
            for(const server of verificationData.serverConnection.servers) await verificationData.serverConnection.syncRoles(guild, member, connection);

            clearTimeout(verificationData.timeout);
            await verificationData.interaction.replyTl(keys.commands.account.success.verified, ph.emojisAndColors());
        }, {
            context: { data },
        });
    }
}
