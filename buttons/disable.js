const Discord = require('discord.js');
const { keys, ph, getActionRows } = require('../api/messages');
const Button = require('../structures/Button');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');

class Disable extends Button {

    constructor() {
        super({
            permissions: new PermissionsBitField(Discord.PermissionFlagsBits.Administrator),
            id: 'disable',
        });
    }

    async execute(interaction, client, server) {
        if(!await super.execute(interaction, client, server)) return;

        const commandName = interaction.customId.split('_').pop();

        if(await server.settings.disable('commands', commandName)) {
            await interaction.replyTl(keys.buttons.disable.success.response, { 'command_name': commandName });
        }
        else {
            return interaction.replyTl(keys.buttons.disable.errors.could_not_disable, { 'command_name': commandName });
        }

        const enableRows = getActionRows(keys.commands.help.success.enable_button, { 'command_name': commandName }, ph.emojis());
        const helpEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(keys.buttons.disable.success.help.embeds[0].description)
            .setColor(Discord.Colors[keys.buttons.disable.success.help.embeds[0].color]);

        return interaction.update({ embeds: [helpEmbed], components: enableRows });
    }
}

module.exports = Disable;
