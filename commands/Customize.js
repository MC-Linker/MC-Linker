import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';

export default class Customize extends Command {

    constructor() {
        super({
            name: 'customize',
            defer: true,
            requiresConnectedServer: false,
            allowUser: true,
            ephemeral: true,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        //TODO
        if(process.env.CUSTOM_BOT !== 'true')
            await interaction.replyTl(keys.api.command.no_access.disabled);

        if(client.customBots.hasCustomBot(interaction.user.id))
            await client.customBots.sendCustomBotManager(interaction, client.customBots.getCustomBot(interaction.user.id));
        else await client.customBots.sendCustomBotCreateWizard(interaction);
    }
}
