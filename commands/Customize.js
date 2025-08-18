import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import Wizard from '../structures/helpers/Wizard.js';
import { getReplyOptions, ph } from '../utilities/messages.js';

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

        const wizard = new Wizard(client, interaction, [
            keys.commands.customize.success.start,
            keys.commands.customize.success.intents,
            keys.commands.customize.success.details,
        ].map(key => getReplyOptions(key, ph.emojisAndColors())), {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });
        await wizard.start();
    }
}
