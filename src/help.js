const fs = require('fs-extra');
const { discordLink } = require('../config.json');
const { keys, ph, addPh, getEmbed, getActionRows } = require('../api/messages');

async function execute(message, args) {
    if(!args[0]) {
        message.replyTl(
            keys.commands.help.success.no_args,
            { 'invite_link': discordLink },
            await ph.allCommands(message.client),
        );
    }
    else {
        const commandName = args[0].toLowerCase();

        let command = keys.data[commandName];
        if(!command) {
            //Show command list of category
            fs.readdir(`./commands/${commandName}`, async (err, commands) => {
                if(err) {
                    message.replyTl(keys.commands.help.warnings.command_does_not_exist, { 'command_name': commandName });
                    return;
                }

                commands = commands.filter(command => command.endsWith('.js'));
                const helpEmbed = getEmbed(keys.commands.help.success.base, ph.std(message));
                for(let commandFile of commands) {
                    commandFile = commandFile.split('.').shift();
                    command = keys.data[commandFile];

                    helpEmbed.addFields(addPh(
                        keys.commands.help.success.category.embeds[0].fields[0],
                        await ph.commandName(command.name, message.client),
                        { 'command_description': command.description },
                    ));
                }

                helpEmbed.addFields(addPh(
                    keys.commands.help.success.category.embeds[0].fields[1],
                    { 'discord_link': discordLink },
                ));

                message.replyOptions({ embeds: [helpEmbed] });
            });
        }
        else {
            // noinspection JSUnresolvedVariable
            const helpEmbed = getEmbed(
                keys.commands.help.success.command,
                ph.std(message),
                {
                    'command_long_description': command.long_description,
                    'command_usage': command.usage,
                    'command_example': command.example,
                },
                await ph.commandName(commandName, message.client),
            );

            if(await settings.isDisabled(message.guildId, 'commands', command.name)) {
                const enableRows = getActionRows(
                    keys.commands.help.success.enable_button,
                    { 'command_name': command.name }, ph.emojis(),
                );

                helpEmbed.setDescription(keys.commands.help.success.disabled.embeds[0].description);
                message.replyOptions({ embeds: [helpEmbed], components: enableRows });
            }
            else {
                const disableRows = getActionRows(
                    keys.commands.help.success.disable_button,
                    { 'command_name': command.name }, ph.emojis(),
                );

                message.replyOptions({ embeds: [helpEmbed], components: disableRows });
            }
        }
    }
}

module.exports = { execute };