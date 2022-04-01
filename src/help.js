const fs = require('fs');
const { discordLink } = require('../config.json');
const { keys, getEmbedBuilder, ph, addPh, getComponentBuilder} = require('../api/messages');
const settings = require('../api/settings');

async function execute(message, args) {
    if(!args[0]) {
        message.respond(keys.commands.help.success.no_args, { "invite_link": discordLink });
    } else {
        const commandName = args[0].toLowerCase();

        let command = keys.data[commandName];
        if (!command) {
            fs.readdir(`./commands/${commandName}`, (err, commands) => {
                if(err) {
                    message.respond(keys.commands.help.warnings.command_does_not_exist, { "command_name": commandName });
                }

                commands = commands.filter(command => command.endsWith('.js'));
                const helpEmbed = getEmbedBuilder(keys.commands.help.success.base, ph.fromStd(message));
                commands.forEach(commandFile => {
                    commandFile = commandFile.split('.').shift();
                    command = keys.data[commandFile];

                    helpEmbed.addField(
                        addPh(keys.commands.help.success.category.fields.command.name, { "command_name": command.name }),
                        addPh(keys.commands.help.success.category.fields.command.content, { "command_short_description": command.short_description })
                    );
                });

                helpEmbed.addField(
                    keys.commands.help.success.category.fields.information.name,
                    addPh(keys.commands.help.success.category.fields.information.content, { "discord_link": discordLink })
                );
                message.reply({ embeds: [helpEmbed] });
            });
        } else {
            const helpEmbed = getEmbedBuilder(
                keys.commands.help.success.command,
                ph.fromStd(message),
                { "command_name": command.name.cap(), "command_long_description": command.long_description, "command_usage": command.usage, "command_example": command.example }
            );

            const disabled = await settings.getDisabled(message.guildId, 'commands');
            if (!disabled.find(disable => disable === command.name)) {
                const disableRow = getComponentBuilder(
                    keys.commands.help.success.disable_button.components,
                    { "command_name": command.name }, ph.fromStd(message)
                );
                message.reply({ embeds: [helpEmbed], components: [disableRow] });
            } else if (disabled) {
                const enableRow = getComponentBuilder(
                    keys.commands.help.success.enable_button.components,
                    { "command_name": command.name }, ph.fromStd(message)
                );
                helpEmbed.setDescription(keys.commands.help.success.disabled.description);
                message.reply({ embeds: [helpEmbed], components: [enableRow] });
            }
        }
    }
}

module.exports = { execute };