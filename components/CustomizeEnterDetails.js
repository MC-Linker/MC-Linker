import Component from '../structures/Component.js';
import { ComponentType } from 'discord.js';
import { getModal, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';

export default class CustomizeTokenModal extends Component {

    constructor() {
        super({
            type: ComponentType.Button,
            id: 'customize_enter_details',
            defer: false,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client) {
        if(!await super.execute(interaction, client)) return;
        return await interaction.showModal(getModal(keys.commands.customize.success.token_modal, ph.emojisAndColors()));
    }
}