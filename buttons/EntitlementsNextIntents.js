import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getReplyOptions } from '../utilities/messages.js';

export default class EntitlementsNextDetails extends Button {

    constructor() {
        super({ id: 'entitlements_next_intents', defer: false });
    }

    async execute(interaction, client) {
        if(interaction.entitlements.size === 0 && process.env.NODE_ENV === 'production')
            return await interaction.update(getReplyOptions(keys.warnings.errors.no_entitlement));

        return await interaction.update(getReplyOptions(keys.entitlements.success.intents)); //TODO make explanation
    }
}