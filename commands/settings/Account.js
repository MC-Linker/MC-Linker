import Command from '../../structures/Command.js';
import keys from '../../api/keys.js';
import * as utils from '../../api/utils.js';
import Discord from 'discord.js';
import crypto from 'crypto';
import { ph } from '../../api/messages.js';
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
            interaction.replyTl(keys.commands.account.success.verified, ph.emojis());
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        if(subcommand === 'connect') {
            const username = args[1];

            if(!server?.hasHttpProtocol() && !server?.hasWebSocketProtocol()) {
                return await interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);
            }

            if(username.match(Discord.MessageMentions.UsersPattern)) {
                return interaction.replyTl(keys.commands.account.warnings.mention);
            }

            const uuid = await utils.fetchUUID(username);
            if(!uuid) {
                return interaction.replyTl(keys.api.utils.errors.could_not_fetch_uuid, { username });
            }

            const code = crypto.randomBytes(16).toString('hex').slice(0, 5);

            const verifyResponse = await server.protocol.verifyUser(code, uuid);
            if(!await utils.handleProtocolResponse(verifyResponse, server.protocol, interaction)) return;

            await interaction.replyTl(keys.commands.account.success.verification_info, {
                code,
                ip: server.ip,
            }, ph.emojis());

            const timeout = setTimeout(async () => {
                await interaction.replyTl(keys.commands.account.warnings.verification_timeout);
            }, 180_000);

            this.waitingInteractions.set(interaction.user.id, { interaction, timeout });
            await client.shard.broadcastEval((c, { id, uuid, username, code, shard, websocket }) => {
                const listener = async data => {
                    if(data.uuid !== uuid || data.code !== code) return;

                    await c.userConnections.connect({
                        id,
                        uuid,
                        username,
                    });

                    const settings = c.userSettingsConnections.cache.get(id);
                    if(settings) await settings.updateRoleConnection(username, {
                        'connectedaccount': 1,
                    });

                    await c.shard.broadcastEval(c => c.emit('accountVerificationResponse', id), { shard });
                };

                if(websocket) c.api.websocket.on('/verify/response', listener);
                else c.api.once('/verify/response', (request, reply) => {
                    reply.send({});
                    listener(request.body);
                });
            }, {
                context: {
                    uuid,
                    username,
                    code,
                    id: interaction.user.id,
                    shard: client.shard.ids[0],
                    websocket: server.hasWebSocketProtocol(),
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
