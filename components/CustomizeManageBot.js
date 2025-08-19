import Component from '../structures/Component.js';

export default class CustomizeTokenModal extends Component {

    constructor() {
        super({
            type: 'Button',
            id: 'customize_manage_bot',
            defer: false,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client) {
        if(!await super.execute(interaction, client)) return;
        const customBotConnection = this.customBots.getCustomBot(interaction.user.id);
        return await this.customBots.sendCustomBotManager(interaction, customBotConnection);
    }
}