import Discord, { EmbedBuilder, PermissionsBitField } from 'discord.js';
import { getActionRows, ph } from '../api/messages.js';
import keys from '../api/keys.js';
import Button from '../structures/Button.js';

export default class Enable extends Button {

    constructor() {
        super({
            permissions: new PermissionsBitField(Discord.PermissionFlagsBits.Administrator),
            id: 'enable',
        });
    }

    async execute(interaction, client, server) {
        if(!await super.execute(interaction, client, server)) return;

        const commandName = interaction.customId.split('_').pop();

        const settings = client.serverSettingsConnections.cache.get(interaction.guildId);

        if(!settings?.isDisabled('bot-commands', commandName)) {
            return interaction.replyTl(keys.buttons.enable.warnings.already_enabled, { 'command_name': commandName.cap() });
        }

        await settings.enable('bot-commands', commandName);
        await interaction.replyTl(keys.buttons.enable.success.response, { 'command_name': commandName.cap() });

        const disableRows = getActionRows(keys.commands.help.success.disable_button, { 'command_name': commandName }, ph.emojis(), ph.colors());
        const helpEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(keys.buttons.enable.success.help.embeds[0].description)
            .setColor(Discord.Colors[keys.buttons.enable.success.help.embeds[0].color]);

        return interaction.message.edit({ embeds: [helpEmbed], components: disableRows });
    }
}
