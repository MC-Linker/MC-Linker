import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';

export default class Customize extends Command {

    constructor() {
        super({
            name: 'customize',
            defer: false,
            requiresConnectedServer: false,
        });
    }

    /**
     * Opens the guild appearance modal, which is handled by the CustomizeGuildAppearanceModal component.
     * Custom bot creation is temporarily disabled: CustomBotConnectionManager.sendCustomBotCreateWizard() and
     * sendCustomBotManager() are intentionally not called from here. Call them again to re-enable it.
     * @inheritdoc
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} interaction - The command interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {[]} args - No arguments.
     * @param {?ServerConnection} server - The connection of the server the command was executed in.
     * @param {import('pino').Logger} logger - A child logger bound to this execution.
     * @returns {Promise<void>}
     * @throws {import('discord.js').DiscordAPIError} If the modal cannot be shown, e.g. the interaction expired.
     */
    async run(interaction, client, args, server, logger) {
        await interaction.showModalTl(keys.commands.customize.customize_guild_appearance_modal);
        // continue in components/CustomizeGuildAppearanceModal
    }
}
