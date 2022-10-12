const Discord = require('discord.js');
const { keys, ph, getActionRows } = require('../api/messages');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const Button = require('../structures/Button');

class Enable extends Button {

    constructor() {
        super({
            permissions: new PermissionsBitField(Discord.PermissionFlagsBits.Administrator),
            id: 'enable',
        });
    }

    async execute(interaction, client, server) {
        if(!await super.execute(interaction, client, server)) return;

        const commandName = interaction.customId.split('_').pop();

        const settings = client.settingsConnections.cache.get(interaction.guildId);

        if(!settings?.isDisabled('commands', commandName)) {
            return interaction.replyTl(keys.buttons.enable.errors.already_enabled, { 'command_name': commandName.cap() });
        }

        await settings.enable('commands', commandName);
        await interaction.replyTl(keys.buttons.enable.success.response, { 'command_name': commandName.cap() });

        const disableRows = getActionRows(keys.commands.help.success.disable_button, { 'command_name': commandName }, ph.emojis());
        const helpEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(keys.buttons.enable.success.help.embeds[0].description)
            .setColor(Discord.Colors[keys.buttons.enable.success.help.embeds[0].color]);

        return interaction.message.edit({ embeds: [helpEmbed], components: disableRows });
    }
}

module.exports = Enable;