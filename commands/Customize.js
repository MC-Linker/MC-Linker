import Command from '../structures/Command.js';

export default class Customize extends Command {

    constructor() {
        super({
            name: 'customize',
            defer: false,
            requiresConnectedServer: false,
            allowUser: true,
            ephemeral: true,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;
        if(!client.customBots.hasCustomBot(interaction.user.id))
            await client.customBots.sendCustomBotManager(interaction);
        await client.customBots.sendCustomBotCreateWizard(interaction);
    }
}
