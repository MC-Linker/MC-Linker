import { addPh, fetchCommand, getEmbed, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { ApplicationCommand, ApplicationCommandOptionType } from 'discord.js';
import AutocompleteCommand from '../structures/AutocompleteCommand.js';

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
        //Push categories
        const categories = [];
        for(const [_, command] of client.commands)
            if(!categories.includes(command.category)) categories.push(command.category);

        const choices = client.commands.values().toArray()
            .filter(c => this.excludedCommands.includes(c.name))
            .map(c => ({ name: c.name.toTitleCase(), value: c.name }))
            .filter(c => c);

        const respondArrray = categories.concat(choices)
            .filter(o => o.value.includes(interaction.options.getFocused().toLowerCase()))
            .slice(0, 24);
        return await interaction.respond(respondArrray);
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

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
                return interaction.editReplyTl(keys.commands.help.warnings.command_does_not_exist, { 'command_name': commandName.toTitleCase() });
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
