import Discord, { EmbedBuilder, PermissionsBitField } from 'discord.js';
import { getActionRows, ph } from '../api/messages.js';
import keys from '../api/keys.js';
import Button from '../structures/Button.js';

export default class Disable extends Button {

    disabledCommands = ['enable', 'disable', 'help'];

    constructor() {
        super({
            permissions: new PermissionsBitField(Discord.PermissionFlagsBits.Administrator),
            id: 'disable',
        });
    }

    async execute(interaction, client, server) {
        if(!await super.execute(interaction, client, server)) return;

        const commandName = interaction.customId.split('_').pop();

        if(this.disabledCommands.includes(commandName)) {
            return interaction.replyTl(keys.commands.disable.warnings.disabled_command, { disable: commandName });
        }

        const settings = await client.serverSettingsConnections.getOrConnect(interaction.guildId);


        if(await settings.disable('botCommands', commandName)) {
            await interaction.replyTl(keys.buttons.disable.success.response, { 'command_name': commandName.cap() });
        }
        else {
            return interaction.replyTl(keys.commands.disable.errors.could_not_disable, { 'command_name': commandName.cap() });
        }

        const enableRows = getActionRows(keys.commands.help.success.enable_button, { 'command_name': commandName }, ph.emojis(), ph.colors());
        const helpEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(keys.buttons.disable.success.help.embeds[0].description)
            .setColor(Discord.Colors[keys.buttons.disable.success.help.embeds[0].color]);

        return interaction.message.edit({ embeds: [helpEmbed], components: enableRows });
    }
}
