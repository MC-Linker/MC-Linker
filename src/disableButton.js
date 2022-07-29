const Discord = require('discord.js');
const settings = require('../api/settings');
const { keys, ph, getEmbedBuilder, getComponentBuilder} = require('../api/messages');

async function execute(interaction) {
    if (!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
        interaction.respond(keys.buttons.disable.warnings.no_permission);
        return;
    }

    const commandName = interaction.customId.split('_').pop();

    //Disable command
    const disabled = await settings.disable(interaction.guildId, 'commands', commandName);
    if(disabled) {
        interaction.respond(keys.buttons.disable.success.response, { "command_name": commandName });
    } else {
        interaction.respond(keys.buttons.disable.errors.could_not_disable, { "command_name": commandName });
        return;
    }

    const command = keys.data[commandName];

    const enableRow = getComponentBuilder(keys.commands.help.success.enable_button, { "command_name": commandName }, ph.emojis());
    const helpEmbed = getEmbedBuilder(
        keys.commands.help.success.command,
        ph.fromStd(interaction),
        { "command_name": command.name.cap(), "command_long_description": command.long_description, "command_usage": command.usage, "command_example": command.example }
    ).setDescription(keys.buttons.disable.success.help.description)
    .setColor(keys.buttons.disable.success.help.color);

    interaction.message.edit({ embeds: [helpEmbed], components: [enableRow] });
}

module.exports = { execute };