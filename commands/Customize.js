import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import Pagination from '../structures/helpers/Pagination.js';

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

        const pagination = new Pagination(client, interaction, {
            entitlements_start: {
                startPage: true,
                options: Object.assign(keys.entitlements.success.start),
            },
            entitlements_next_intents: {
                options: keys.entitlements.success.intents,
            },
            entitlements_back_start: {
                options: keys.entitlements.success.start,
            },
            entitlements_next_details: {
                options: keys.entitlements.success.details,
            },
            entitlements_enter_details: {
                options: keys.entitlements.success.token_modal,
            },
        });

        return await pagination.start();
    }
}
