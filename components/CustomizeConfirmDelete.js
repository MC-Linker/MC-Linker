import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import { ph } from '../utilities/messages.js';

export default class CustomizeTokenModal extends Component {

    constructor() {
        super({
            type: 'ModalSubmit',
            id: 'customize_confirm_delete',
            defer: true,
            ephemeral: true,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client) {
        if(!await super.execute(interaction, client)) return;

        await this.disconnect(customBotConnection);
        await interaction.reply(getReplyOptions(keys.entitlements.custom_bot_manager.success.delete, ph.emojisAndColors()));
    }
}