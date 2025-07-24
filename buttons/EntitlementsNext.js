import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getReplyOptions } from '../utilities/messages.js';

export default class EntitlementsNext extends Button {

    constructor() {
        super({ id: 'entitlements_next', defer: false });
    }

    async execute(interaction, client) {
        if(interaction.entitlements.size === 0)
            return await interaction.replyTl(keys.entitlements.warnings.no_entitlement);

        return await interaction.update(getReplyOptions(keys.entitlements.success.details)); //TODO make explanation
    }
}