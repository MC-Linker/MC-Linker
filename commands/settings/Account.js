import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import Discord from 'discord.js';
import crypto from 'crypto';
import { ph } from '../../utilities/messages.js';
import client from '../../bot.js';

export default class Account extends Command {

    waitingInteractions = new Map();

    constructor() {
        super({
            name: 'account',
            category: 'settings',
            requiresConnectedServer: false,
            ephemeral: true,
        });

        client.on('accountVerificationResponse', id => {
            if(!this.waitingInteractions.has(id)) return;

            const { interaction, timeout } = this.waitingInteractions.get(id);
            clearTimeout(timeout);
            interaction.replyTl(keys.commands.account.success.verified, ph.emojisAndColors());
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        if(subcommand === 'connect') {
            if(!server?.protocol?.isPluginProtocol()) {
                return await interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);
            }

            if(args[1].match(Discord.MessageMentions.UsersPattern)) {
                return interaction.replyTl(keys.commands.account.warnings.mention);
            }

            const {
                uuid,
                username,
                error,
            } = await client.userConnections.userFromArgument(args[1], server, interaction);
            if(error) return;

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

            this.waitingInteractions.set(interaction.user.id, { interaction, timeout });
            await client.shard.broadcastEval((c, { uuid, username, code, userId, serverId, shard, websocket }) => {
                const listener = async data => {
                    if(data.uuid !== uuid || data.code !== code) return;

                    await c.userConnections.connect({
                        id: userId,
                        uuid,
                        username,
                    });

                    const settings = c.userSettingsConnections.cache.get(userId);
                    if(settings) await settings.updateRoleConnection(username, {
                        'connectedaccount': 1,
                    });

                    await c.shard.broadcastEval((c, { id }) => c.emit('accountVerificationResponse', id), {
                        context: { id: userId },
                        shard,
                    });
                };

                if(websocket) {
                    const socket = c.serverConnections.cache.get(serverId).protocol.socket;
                    socket.on('verify-response', data => {
                        listener(JSON.parse(data));
                    });
                }
                else c.api.once('/verify/response', (request, reply) => {
                    reply.send({});
                    listener(request.body);
                });
            }, {
                context: {
                    uuid,
                    username,
                    code,
                    userId: interaction.user.id,
                    serverId: server.id,
                    shard: client.shard.ids[0],
                    websocket: server.protocol.isWebSocketProtocol(),
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
            await interaction.replyTl(keys.commands.disconnect.success, {
                protocol: 'account',
                protocol_cap: 'Account',
            });
        }
    }
}
