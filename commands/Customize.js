import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';

export default class Customize extends Command {

    constructor() {
        super({
            name: 'customize',
            defer: false,
            allowUser: true,
        });
    }

    async execute(interaction, client, args) {
        if(interaction.entitlements.size === 0)
            return await interaction.replyTl(keys.entitlements.warnings.no_entitlement);

        return await interaction.replyTl(keys.entitlements.success.start);
    }
}
