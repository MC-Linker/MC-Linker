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

        if(await server.settings.enable('commands', commandName)) {
            await interaction.replyTl(keys.buttons.enable.success.response, { 'command_name': commandName });
        }
        else {
            return interaction.replyTl(keys.buttons.enable.errors.already_enabled, { 'command_name': commandName });
        }

        const disableRows = getActionRows(keys.commands.help.success.disable_button, { 'command_name': commandName }, ph.emojis());
        const helpEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(keys.buttons.enable.success.help.embeds[0].description)
            .setColor(Discord.Colors[keys.commands.help.success.command.embeds[0].color]);

        return interaction.update({ embeds: [helpEmbed], components: disableRows });
    }
}

module.exports = Enable;