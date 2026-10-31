import { RESTJSONErrorCodes } from 'discord.js';
import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import { isDiscordError } from '../utilities/utils.js';

export default class CustomizeGuildAppearanceModal extends Component {

    constructor() {
        super({
            type: 'ModalSubmit',
            id: 'customize_guild_appearance_modal',
            defer: false,
        });
    }

    /**
     * @inheritdoc
     * @param {import('discord.js').ModalSubmitInteraction & TranslatedResponses} interaction - The submitted modal.
     * @param {MCLinker} client - The MCLinker client.
     * @param {?ServerConnection} server - The connection of the server the modal was submitted in.
     * @param {import('pino').Logger} logger - A child logger bound to this execution.
     * @returns {Promise<void>}
     * @throws {import('discord.js').DiscordAPIError} If the reply cannot be sent, e.g. the interaction expired.
     */
    async run(interaction, client, server, logger) {
        const nick = interaction.fields.getTextInputValue('nickname') ?? null;
        const bio = interaction.fields.getTextInputValue('bio') ?? null;
        const avatar = interaction.fields.getUploadedFiles('avatar')?.first()?.url ?? null;
        const banner = interaction.fields.getUploadedFiles('banner')?.first()?.url ?? null;

        try {
            await interaction.guild.members.editMe({
                nick,
                avatar,
                banner,
                bio,
                reason: `Customized bot appearance by ${interaction.user.displayName} (${interaction.user.id})`,
            });
        }
        catch(err) {
            // Field rate limits (e.g. AVATAR_RATE_LIMIT) are a 400 Invalid Form Body, not a 429
            if(isDiscordError(err, RESTJSONErrorCodes.InvalidFormBodyOrContentType) && JSON.stringify(err.rawError?.errors ?? {}).includes('_RATE_LIMIT')) {
                logger.debug({
                    guildId: interaction.guildId,
                    userId: interaction.user.id
                }, 'Bot appearance rate-limited, skipping');
                return await interaction.replyTl(keys.commands.customize.errors.appearance_rate_limited);
            }

            client.analytics.trackError('component', 'Customize', interaction.guildId, interaction.user.id, err, null, logger);
            return await interaction.replyTl(keys.commands.customize.errors.guild_appearance_update_failed);
        }

        await interaction.replyTl(keys.commands.customize.success.guild_appearance_updated);
    }
}
