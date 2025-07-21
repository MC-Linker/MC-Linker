import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { UUIDRegex } from '../../utilities/utils.js';
import Discord from 'discord.js';
import crypto from 'crypto';
import { ph } from '../../utilities/messages.js';

export default class Account extends Command {

    pendingInteractions = new Map();

    constructor() {
        super({
            name: 'account',
            category: 'settings',
            requiresConnectedServer: false,
            ephemeral: true,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        if(subcommand === 'connect') {
            const usernameOrUUID = args[1];
            if(usernameOrUUID.match(Discord.MessageMentions.UsersPattern)) {
                return interaction.replyTl(keys.commands.account.warnings.mention);
            }

            let uuid;
            let username;
            if(usernameOrUUID.match(UUIDRegex)) {
                uuid = usernameOrUUID;
                username = await utils.fetchUsername(uuid);
            }
            else {
                uuid = await utils.fetchUUID(usernameOrUUID);
                username = usernameOrUUID;
            }
            if(!uuid || !username) return await interaction.replyTl(keys.commands.account.errors.could_not_fetch_uuid, { user: usernameOrUUID });

            const code = crypto.randomBytes(16).toString('hex').slice(0, 5);

            const verifyResponse = await server.protocol.verifyUser(code, uuid);
            if(!await utils.handleProtocolResponse(verifyResponse, server.protocol, interaction)) return;

            await interaction.replyTl(keys.commands.account.step.verification_info, {
                code,
                ip: server.getDisplayIp(),
            }, ph.emojisAndColors());

            const timeout = setTimeout(async () => {
                await interaction.replyTl(keys.commands.account.warnings.verification_timeout);
            }, 180_000);

            this.pendingInteractions.set(interaction.user.id, { interaction, timeout });
            await client.shard.broadcastEval((c, { uuid, username, code, userId, serverId, shard }) => {
                const listener = async data => {
                    if(data.uuid !== uuid || data.code !== code) return;

                    const connection = await c.userConnections.connect({
                        id: userId,
                        uuid,
                        username,
                    });

                    const settings = c.userSettingsConnections.cache.get(userId);
                    if(settings) await settings.updateRoleConnection(username, {
                        'connectedaccount': 1,
                    });

                    await client.serverConnections.cache.get(serverId).syncRoles(interaction.guild, interaction.member, connection);

                    await c.shard.broadcastEval((c, { id }) => c.emit('accountVerificationResponse', id), {
                        context: { id: userId },
                        shard,
                    });
                };

                const socket = c.serverConnections.cache.get(serverId).protocol.socket;
                socket.on('verify-response', data => listener(JSON.parse(data)));
            }, {
                context: {
                    uuid,
                    username: usernameOrUUID,
                    code,
                    userId: interaction.user.id,
                    serverId: server.id,
                    shard: client.shard.ids[0],
                },
                shard: 0,
            });
        }
        else if(subcommand === 'disconnect') {
            const connection = client.userConnections.cache.get(interaction.user.id);
            if(!connection) {
                return interaction.replyTl(keys.commands.account.warnings.not_connected);
            }

            const settings = await client.userSettingsConnections.cache.get(interaction.user.id);
            if(settings) await settings.updateRoleConnection(connection.username, {
                'connectedaccount': 0,
            });

            await client.userConnections.disconnect(interaction.user.id);

            if(server.requiredRoleToJoin) await server.protocol.execute(`kick ${connection.username} §cYou have been disconnected from your account.`);
            await interaction.replyTl(keys.commands.disconnect.success, {
                protocol: 'account',
                protocol_cap: 'Account',
            });
        }
    }
}
