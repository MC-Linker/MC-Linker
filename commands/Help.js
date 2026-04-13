import { addPh, fetchCommand, getEmbed, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { ApplicationCommand, ApplicationCommandOptionType } from 'discord.js';
import AutocompleteCommand from '../structures/AutocompleteCommand.js';
import { toTitleCase } from '../utilities/utils.js';

export default class Help extends AutocompleteCommand {

    excludedCommands = ['help', 'eval', 'systemstats'];

    constructor() {
        super({
            name: 'help',
            requiresConnectedServer: false,
            allowUser: true,
        });
    }

    async autocomplete(interaction, client) {
        /** @type {Command[]} */
        const filteredCommands = client.commands.values().toArray().filter(c => !this.excludedCommands.includes(c.name));

        //Push categories
        const categories = [];
        for(const command of filteredCommands)
            if(command.category && !categories.includes(command.category))
                categories.push(command.category);

        const commandNames = filteredCommands
            .map(c => c.name)
            .filter(c => c);

        const respondArray = categories.concat(commandNames)
            .filter(o => o.includes(interaction.options.getFocused().toLowerCase()))
            .slice(0, 25)
            .map(o => ({ name: toTitleCase(o), value: o }));
        return await interaction.respond(respondArray);
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[string]} args - [0] The command or category name.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const commandName = args[0]?.toLowerCase();

        const helpEmbed = getEmbed(keys.commands.help.success.base, ph.std(interaction));
        if(!commandName || commandName === 'help') {
            helpEmbed.addFields(addPh(keys.commands.help.success.no_args.embeds[0].fields,
                { 'invite_link': client.config.supportServerInvite },
                await ph.allCommands(),
            ));
            return interaction.editReply({ embeds: [helpEmbed] });
        }

        const command = keys.data[commandName];
        if(!command) {
            const commands = client.commands.filter(c => c.category === commandName);

            //Show command list of category
            if(!commands.size) {
                return interaction.editReplyTl(keys.commands.help.warnings.command_does_not_exist, { 'command_name': toTitleCase(commandName) });
            }

            for(let command of commands.values()) {
                command = keys.data[command.name];

                helpEmbed.addFields(addPh(
                    keys.commands.help.success.category.embeds[0].fields[0],
                    await ph.commandName(command.name, false),
                    { 'command_description': command.description },
                ));
            }

            helpEmbed.addFields(addPh(
                keys.commands.help.success.category.embeds[0].fields[1],
                { 'invite_link': client.config.supportServerInvite },
                await ph.commandName('help'),
            ));

            return interaction.editReply({ embeds: [helpEmbed] });
        }
        else {
            const slashCommand = await fetchCommand(client.application.commands, command.name);
            const commandUsage = getCommandUsage(slashCommand);

            // noinspection JSUnresolvedVariable
            helpEmbed.addFields(addPh(
                keys.commands.help.success.command.embeds[0].fields,
                ph.std(interaction),
                {
                    'command_long_description': command.long_description,
                    'command_usage': commandUsage,
                    'invite_link': client.config.supportServerInvite,
                },
                await ph.commandName(commandName, false),
            ));
            return interaction.editReply({ embeds: [helpEmbed] });

            /**
             * @param {ApplicationCommand|import('discord.js').ApplicationCommandSubCommand} command
             * @returns {string}
             */
            function getCommandUsage(command) {
                let usage = [];

                if(!command.options) usage.push(''); //No options
                for(const option of command.options ?? []) {
                    if(option.type === ApplicationCommandOptionType.Subcommand) {
                        usage.push(`${getCommandUsage(option)}`);
                    }
                    else {
                        if(!usage.length) usage.push('');
                        usage[0] += option.required ? ` <${option.name}>` : ` [${option.name}]`;
                    }
                }

                if(command instanceof ApplicationCommand) usage = usage.map(u => `/${command.name} ${u}`);
                else usage = usage.map(u => `${command.name} ${u}`);
                return usage.join('\n').trim();
            }
        }
    }
}
