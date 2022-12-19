import Command from '../../structures/Command.js';
import keys from '../../api/keys.js';
import utils from '../../api/utils.js';
import Discord from 'discord.js';
import crypto from 'crypto';
import { ph } from '../../api/messages.js';

export default class Account extends Command {

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
            const username = args[1];

            if(!server?.hasPluginProtocol()) {
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

            client.api.once('/verify/response', async (request, reply) => {
                if(request.body.uuid !== uuid || request.body.code !== code) return;
                reply.send({});

                clearTimeout(timeout);

                await client.userConnections.connect({
                    id: interaction.user.id,
                    uuid,
                    username,
                });

                await interaction.replyTl(keys.commands.account.success.verified, ph.emojis());
            });
        }
        else if(subcommand === 'disconnect') {
            if(!client.userConnections.cache.has(interaction.user.id)) {
                return interaction.replyTl(keys.commands.account.warnings.not_connected);
            }

            await client.userConnections.disconnect(interaction.user.id);
            await interaction.replyTl(keys.commands.disconnect.success, {
                protocol: 'account',
                protocol_cap: 'Account',
            });
        }
    }
}
