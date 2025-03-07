import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getReplyOptions } from '../utilities/messages.js';

export default class EntitlementsNextButton extends Button {

    constructor() {
        super({ id: `entitlements_next` });
    }

    async execute(interaction, client, args) {
        return await interaction.deferUpdate(getReplyOptions(keys.entitlements.success.details)); //TODO make explanation website + talk about intents
    }
}