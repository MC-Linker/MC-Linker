import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import logger from '../utilities/logger.js';

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

        if(interaction.fields.getTextInputValue('confirm_delete') !== 'delete')
            return await interaction.replyTl(keys.custom_bot.custom_bot_manager.warnings.invalid_confirmation);

        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
        logger.info(`Custom bot connection for ${interaction.user.id} deleted with reason: ${reason}`);

        const customBotConnection = client.customBots.getCustomBot(interaction.user.id);
        await this.disconnect(customBotConnection);

        const message = await interaction.message.fetch();
        message.embeds[0].fields[0].value = keys.custom_bot.custom_bot_manager.status.deleted;
        message.components = [];

        await interaction.replyTl(keys.custom_bot.custom_bot_manager.success.delete);
        await interaction.update(message);
    }
}