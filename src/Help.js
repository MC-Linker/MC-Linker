const fs = require('fs-extra');
const { discordLink } = require('../config.json');
const { keys, ph, addPh, getEmbed, getActionRows } = require('../api/messages');
const Command = require('../structures/Command');

class Help extends Command {

    constructor() {
        super({
            name: 'help',
            requiresConnectedServer: false,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const commandName = args[0]?.toLowerCase();

        if(!args[0]) {
            return interaction.replyTl(
                keys.commands.help.success.no_args,
                { 'invite_link': discordLink },
                await ph.allCommands(interaction.client),
            );
        }

        let command = keys.data[commandName];
        if(!command) {
            //Show command list of category
            fs.readdir(`./commands/${commandName}`, async (err, commands) => {
                if(err) {
                    return interaction.replyTl(keys.commands.help.warnings.command_does_not_exist, { 'command_name': commandName });
                }

                commands = commands.filter(command => command.endsWith('.js'));
                const helpEmbed = getEmbed(keys.commands.help.success.base, ph.std(interaction));
                for(let commandFile of commands) {
                    commandFile = commandFile.split('.').shift();
                    command = keys.data[commandFile.toLowerCase()];

                    helpEmbed.addFields(addPh(
                        keys.commands.help.success.category.embeds[0].fields[0],
                        await ph.commandName(command.name, interaction.client),
                        { 'command_description': command.description },
                    ));
                }

                helpEmbed.addFields(addPh(
                    keys.commands.help.success.category.embeds[0].fields[1],
                    { 'discord_link': discordLink },
                ));

                return interaction.replyOptions({ embeds: [helpEmbed] });
            });
        }
        else {
            // noinspection JSUnresolvedVariable
            const helpEmbed = getEmbed(
                keys.commands.help.success.command,
                ph.std(interaction),
                {
                    'command_long_description': command.long_description,
                    'command_usage': command.usage,
                    'command_example': command.example,
                },
                await ph.commandName(commandName, interaction.client),
            );

            if(server?.settings?.isDisabled('commands', command.name) ?? true) {
                const enableRows = getActionRows(
                    keys.commands.help.success.enable_button,
                    { 'command_name': command.name }, ph.emojis(),
                );

                helpEmbed.setDescription(keys.commands.help.success.disabled.embeds[0].description);
                return interaction.replyOptions({ embeds: [helpEmbed], components: enableRows });
            }
            else {
                const disableRows = getActionRows(
                    keys.commands.help.success.disable_button,
                    { 'command_name': command.name }, ph.emojis(),
                );

                return interaction.replyOptions({ embeds: [helpEmbed], components: disableRows });
            }
        }
    }

}

module.exports = Help;