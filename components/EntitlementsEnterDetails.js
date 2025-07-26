import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import { getModal } from '../utilities/messages.js';
import { InteractionType } from 'discord.js';

export default class EntitlementsEnterDetails extends Component {

    constructor() {
        super({
            interactionType: InteractionType.MessageComponent,
            id: 'entitlements_enter_details',
            defer: false,
        });
    }

    async execute(interaction, client) {
        if(interaction.entitlements.size === 0 && process.env.NODE_ENV === 'production')
            return await interaction.replyTl(keys.warnings.errors.no_entitlement);

        await interaction.showModal(getModal(keys.entitlements.success.token_modal));
    }
}