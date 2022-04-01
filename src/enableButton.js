const Discord = require('discord.js');
const settings = require('../api/settings');
const { keys, ph, getEmbedBuilder, getComponentBuilder} = require('../api/messages');

async function execute(interaction) {
    if (interaction.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        const commandName = interaction.customId.split('_').pop();

        const enable = await settings.enable(interaction.guildId, 'commands', commandName);
        if(enable) {
            interaction.respond(keys.buttons.enable.success.response, { "command_name": commandName });
        } else {
            interaction.respond(keys.buttons.enable.errors.already_enabled, { "command_name": commandName });
        }

        const command = interaction.client.commands.get(commandName);

        const disableRow = getComponentBuilder(keys.commands.help.success.enable_button, { "command_name": commandName });
        const helpEmbed = getEmbedBuilder(
          keys.commands.help.success.command,
            ph.fromStd(interaction),
            { "command_name": command.name.cap(), "command_long_description": command.long_description, "command_usage": command.usage, "command_example": command.example }
        ).setDescription(keys.buttons.enable.success.help.description)
        .setColor(keys.buttons.enable.success.help.color);

        interaction.message.edit({ embeds: [helpEmbed], components: [disableRow] });
    } else {
        interaction.respond(keys.buttons.enable.warnings.no_permission);
    }
}

module.exports = { execute };