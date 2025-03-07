import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getReplyOptions } from '../utilities/messages.js';

export default class EntitlementsNextButton extends Button {

    constructor() {
        super({ id: 'entitlements_next', defer: false });
    }

    async execute(interaction, client) {
        return await interaction.update(getReplyOptions(keys.entitlements.success.details)); //TODO make explanation website + talk about intents
    }
}