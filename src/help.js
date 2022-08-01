const fs = require('fs-extra');
const { EmbedBuilder, ButtonBuilder } = require('discord.js');
const { discordLink } = require('../config.json');
const { keys, ph, addPh } = require('../api/messages');
const settings = require('../api/settings');

async function execute(message, args) {
    if(!args[0]) {
        message.respond(
            keys.commands.help.success.no_args,
            { "invite_link": discordLink },
            await ph.fromAllCommands(message.client),
        );
    } else {
        const commandName = args[0].toLowerCase();

        let command = keys.data[commandName];
        if (!command) {
            fs.readdir(`./commands/${commandName}`, async (err, commands) => {
                if (err) {
                    message.respond(keys.commands.help.warnings.command_does_not_exist, {"command_name": commandName});
                    return;
                }

                commands = commands.filter(command => command.endsWith('.js'));
                const helpEmbed = EmbedBuilder.from(addPh(keys.commands.help.success.base, ph.fromStd(message)));
                for (let commandFile of commands) {
                    commandFile = commandFile.split('.').shift();
                    command = keys.data[commandFile];

                    helpEmbed.addFields(addPh(
                        keys.commands.help.success.category.embeds[0].fields[0],
                        await ph.fromCommandName(commandName, message.guild)
                    ));
                }

                helpEmbed.addFields(addPh(
                    keys.commands.help.success.category.embeds[0].fields[1],
                    { "discord_link": discordLink }, await ph.fromCommandName(commandName, message.guild)
                ));

                message.replyOptions({ embeds: [helpEmbed] });
            });
        } else {
            // noinspection JSUnresolvedVariable
            const helpEmbed = EmbedBuilder.from(addPh(
                keys.commands.help.success.command,
                ph.fromStd(message),
                { "command_long_description": command.long_description, "command_usage": command.usage, "command_example": command.example },
                await ph.fromCommandName(commandName, message.guild)
            ));

            const disabled = await settings.getDisabled(message.guildId, 'commands');
            if (!disabled.find(disable => disable === command.name)) {
                const disableRow = ButtonBuilder.from(addPh(
                    keys.commands.help.success.disable_button.components[0],
                    { "command_name": command.name }, ph.emojis()
                ));

                message.replyOptions({ embeds: [helpEmbed], components: [disableRow] });
            } else if (disabled) {
                const enableRow = ButtonBuilder.from(addPh(
                    keys.commands.help.success.enable_button.components[0],
                    { "command_name": command.name }, ph.emojis()
                ));

                helpEmbed.setDescription(keys.commands.help.success.disabled.description);
                message.replyOptions({ embeds: [helpEmbed], components: [enableRow] });
            }
        }
    }
}

module.exports = { execute };