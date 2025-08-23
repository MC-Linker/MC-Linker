import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import logger from '../utilities/logger.js';
import { getReplyOptions, ph } from '../utilities/messages.js';
import { MessageFlags } from 'discord.js';

export default class CustomizeTokenModal extends Component {

    constructor() {
        super({
            type: 'ModalSubmit',
            id: 'customize_confirm_delete',
            defer: false,
            ephemeral: true,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client) {
        if(!await super.execute(interaction, client)) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if(interaction.fields.getTextInputValue('confirm_delete') !== 'delete') {
            return await interaction.editReply(getReplyOptions(keys.custom_bot.custom_bot_manager.warnings.invalid_confirmation, ph.emojisAndColors()));
        }

        const reason = interaction.fields.getTextInputValue('confirm_delete_reason') || 'No reason provided';
        logger.info(`Custom bot connection for ${interaction.user.id} deleted with reason: "${reason}"`);

        const customBotConnection = client.customBots.getCustomBot(interaction.user.id);
        await client.customBots.disconnect(customBotConnection);

        await interaction.editReply(getReplyOptions(keys.custom_bot.custom_bot_manager.success.delete, ph.emojisAndColors()));

        const message = getReplyOptions(keys.custom_bot.custom_bot_manager.success.main, ph.emojisAndColors(), {
            port: '-',
            invite: '', // needed for component builder to build
            status: keys.custom_bot.custom_bot_manager.status.deleted,
        });
        await interaction.update(message);
    }
}