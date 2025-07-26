import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import { InteractionType } from 'discord.js';

export default class EntitlementsNextDetails extends Component {

    constructor() {
        super({
            interactionType: InteractionType.MessageComponent,
            id: 'entitlements_next_port',
            defer: false,
        });
    }

    async execute(interaction, client) {
        if(interaction.entitlements.size === 0 && process.env.NODE_ENV === 'production')
            return await interaction.replyTl(keys.warnings.errors.no_entitlement);

        //Todo grab invite link and port
        //TODO Add control buttons (start/stop, edit details)
        return await interaction.replyTl(keys.entitlements.success.finish);
    }
}