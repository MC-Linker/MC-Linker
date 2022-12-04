import Command from '../../structures/Command.js';
import keys from '../../api/keys';
import utils from '../../api/utils.js';
import Discord from 'discord.js';

export default class Account extends Command {

    constructor() {
        super({
            name: 'account',
            category: 'settings',
            requiresConnectedServer: false,
        });
    }


    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        if(subcommand === 'connect') {
            const username = args[1];

            if(username.match(Discord.MessageMentions.UsersPattern)) {
                return interaction.replyTl(keys.commands.account.warnings.mention);
            }

            let uuid = await utils.fetchUUID(username);
            if(!uuid) {
                return interaction.replyTl(keys.api.utils.errors.could_not_fetch_uuid, { username });
            }

            await client.userConnections.connect({
                id: interaction.user.id,
                uuid,
                username,
            });

            await interaction.replyTl(keys.commands.account.success, { username, uuid });
        }
        else if(subcommand === 'disconnect') {
            if(!client.userConnections.cache.has(interaction.user.id)) {
                return interaction.replyTl(keys.commands.account.warnings.not_connected);
            }

            await client.userConnections.disconnect(interaction.user.id);
            await interaction.replyTl(keys.commands.disconnect.success, { method: 'account', method_cap: 'Account' });
        }
    }
}
