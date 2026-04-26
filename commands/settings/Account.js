import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { UUIDRegex } from '../../utilities/utils.js';
import Discord from 'discord.js';
import crypto from 'crypto';
import MCLinkerAPI from '../../api/MCLinkerAPI.js';

export default class Account extends AutocompleteCommand {

    constructor() {
        super({
            name: 'account',
            category: 'settings',
            requiresConnectedServer: false,
            allowUser: true,
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     */
    autocomplete(interaction, client) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);
        const focused = interaction.options.getFocused(true);

        if(subcommandGroup === 'dms' && subcommand === 'unblock' && focused.name === 'player') {
            const settings = client.userSettingsConnections.cache.get(interaction.user.id);
            const blockedPlayers = settings?.dms.blockedPlayers ?? [];
            const focusedValue = focused.value.toLowerCase();

            const choices = blockedPlayers
                .filter(p => p.startsWith(focusedValue))
                .map(p => ({ name: p, value: p }));

            return interaction.respond(choices).catch(() => {});
        }

        return interaction.respond([]).catch(() => {});
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[string, string]} args - [0] The subcommand (connect/disconnect/dms), [1] The username or UUID to connect.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const subcommandGroup = args[0];
        const subcommand = subcommandGroup === 'dms' ? args[1] : args[0];

        if(subcommand === 'connect') {
            if(!interaction.inGuild()) return interaction.editReplyTl(keys.main.no_access.not_in_guild);
            if(!server) return interaction.editReplyTl(keys.api.command.errors.server_not_connected);

            const usernameOrUUID = args[1];
            if(usernameOrUUID.match(Discord.MessageMentions.UsersPattern)) return interaction.editReplyTl(keys.commands.account.warnings.mention);

            let uuid;
            let username;
            if(usernameOrUUID.match(UUIDRegex)) {
                uuid = usernameOrUUID;
                username = await utils.fetchUsername(uuid);
            }
            else {
                uuid = server.online ? await utils.fetchUUID(usernameOrUUID) : utils.createUUIDv3(usernameOrUUID);
                username = usernameOrUUID;
            }
            if(!uuid || !username) return await interaction.editReplyTl(keys.commands.account.errors.could_not_fetch_uuid, { user: usernameOrUUID });

            const code = crypto.randomBytes(16).toString('hex').slice(0, 5);

            const verifyResponse = await server.protocol.verifyUser(code, uuid);
            if(!await utils.handleProtocolResponse(verifyResponse, server.protocol, interaction)) return;

            await interaction.editReplyTl(keys.commands.account.step.verification_info, {
                code,
                ip: server.displayIp,
            });

            const verificationResponse = await client.broadcastEval(async (c, { uuid, code, serverId }) => {
                const server = c.serverConnections.cache.get(serverId);
                const socket = server?.protocol.socket;
                if(!socket) return { status: 'timeout' };

                try {
                    const data = await c.api.waitForWSEvent(socket, 'verify-response', 180_000, rawData => {
                        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                        if(parsed.uuid !== uuid || parsed.code !== code) return;
                        return parsed;
                    });
                    return { status: 'success', data };
                }
                catch(err) {
                    if(err instanceof MCLinkerAPI.EventTimeoutError) return { status: 'timeout' };
                    return { status: 'error', error: err.message };
                }
            }, {
                context: {
                    uuid,
                    code,
                    serverId: server.id,
                },
                shard: 0,
            });

            if(verificationResponse.status === 'timeout') return interaction.editReplyTl(keys.commands.account.warnings.verification_timeout);
            else if(verificationResponse.status !== 'success') return interaction.editReplyTl(keys.main.errors.could_not_execute_command);

            await client.userConnections.connect({
                id: interaction.user.id,
                uuid,
                username,
            });

            const settings = client.userSettingsConnections.cache.get(interaction.user.id);
            if(settings) await settings.updateRoleConnection(username, {
                'connectedaccount': 1,
            });

            await client.serverConnections.syncRolesAcrossAllServers(interaction.user.id);
            await interaction.editReplyTl(keys.commands.account.success.verified);
        }
        else if(subcommand === 'disconnect') {
            const connection = client.userConnections.cache.get(interaction.user.id);
            if(!connection) return interaction.editReplyTl(keys.commands.account.warnings.not_connected);

            const settings = await client.userSettingsConnections.cache.get(interaction.user.id);
            if(settings) await settings.updateRoleConnection(connection.username, {
                'connectedaccount': 0,
            });

            await client.userConnections.disconnect(interaction.user.id);

            await client.serverConnections.kickFromRequiredRoleServers(interaction.user.id, connection.username, '§cYou have been disconnected from your account.');
            await interaction.editReplyTl(keys.commands.account.success.disconnect);
        }
        else if(subcommand === 'block' || subcommand === 'unblock') {
            const isBlock = subcommand === 'block';
            const playerArg = interaction.options.getString('player', false);
            const serverArg = interaction.options.getBoolean('server', false);

            if(serverArg && !server) return interaction.editReplyTl(keys.commands.account.warnings.dms_no_server);

            const userSettings = await client.userSettingsConnections.getOrConnect(interaction.user.id);
            const { dms } = userSettings;

            // Global
            if(!playerArg && !serverArg) {
                if(isBlock && !dms.enabled) return interaction.editReplyTl(keys.commands.account.warnings.dms_already_blocked_global);
                if(!isBlock && dms.enabled) return interaction.editReplyTl(keys.commands.account.warnings.dms_not_blocked_global);

                dms.enabled = !isBlock;
                await userSettings.edit({ dms });
                return interaction.editReplyTl(isBlock ? keys.commands.account.success.dms_block_global : keys.commands.account.success.dms_unblock_global);
            }

            const applied = [];

            if(playerArg) {
                const player = playerArg.toLowerCase();
                if(isBlock && !dms.blockedPlayers.includes(player)) {
                    dms.blockedPlayers.push(player);
                    applied.push(playerArg);
                }
                else if(!isBlock && dms.blockedPlayers.includes(player)) {
                    dms.blockedPlayers = dms.blockedPlayers.filter(p => p !== player);
                    applied.push(playerArg);
                }
            }

            if(serverArg) {
                if(isBlock && !dms.blockedServers.includes(server.id)) {
                    dms.blockedServers.push(server.id);
                    applied.push(server.displayIp);
                }
                else if(!isBlock && dms.blockedServers.includes(server.id)) {
                    dms.blockedServers = dms.blockedServers.filter(id => id !== server.id);
                    applied.push(server.displayIp);
                }
            }

            if(!applied.length) {
                const target = playerArg ?? server.displayIp;
                return interaction.editReplyTl(isBlock ? keys.commands.account.warnings.dms_already_blocked_specific : keys.commands.account.warnings.dms_not_blocked_specific, { target });
            }

            await userSettings.edit({ dms });
            return interaction.editReplyTl(
                isBlock ? keys.commands.account.success.dms_block_specific : keys.commands.account.success.dms_unblock_specific,
                { target: applied.join(', ') },
            );
        }
    }
}
