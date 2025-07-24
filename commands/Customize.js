import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import { getReplyOptions } from '../utilities/messages.js';

export default class Customize extends Command {

    constructor() {
        super({
            name: 'customize',
            defer: false,
            allowUser: true,
            ephemeral: true,
        });
    }

    async execute(interaction, client, args) {
        if(interaction.entitlements.size === 0 && process.env.NODE_ENV === 'production')
            return await interaction.replyTl(getReplyOptions(keys.warnings.errors.no_entitlement));

        return await interaction.replyTl(keys.entitlements.success.start);
    }
}
