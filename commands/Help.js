import { addPh, fetchCommand, getEmbed, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { ApplicationCommand, ApplicationCommandOptionType } from 'discord.js';
import AutocompleteCommand from '../structures/AutocompleteCommand.js';
import fs from 'fs-extra';

export default class Help extends AutocompleteCommand {

    excludedCommands = ['help', 'eval', 'systemstats'];

    constructor() {
        super({
            name: 'help',
            requiresConnectedServer: false,
        });
    }

    async autocomplete(interaction, client) {
        //Push categories
        const commandDirs = await fs.readdir('./commands/');
        const categories = [];
        for(const dir of commandDirs) {
            if((await fs.stat(`./commands/${dir}`)).isDirectory()) categories.push({
                name: dir.toTitleCase(),
                value: dir,
            });
        }
        console.log(categories);
        const choices = client.commands.values().toArray()
            .map(c => {
                if(this.excludedCommands.includes(c.name)) return null;
                return { name: c.name.toTitleCase(), value: c.name };
            }).filter(c => c);
        console.log(choices);

        const respondArrray = categories
            .concat(choices)
            .filter(o => o.value.includes(interaction.options.getFocused()))
            .slice(0, 24);
        return await interaction.respond(respondArrray);
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const commandName = args[0]?.toLowerCase();

        const helpEmbed = getEmbed(keys.commands.help.success.base, ph.std(interaction));
        if(!commandName || commandName === 'help') {
            helpEmbed.addFields(addPh(keys.commands.help.success.no_args.embeds[0].fields,
                { 'invite_link': process.env.DISCORD_LINK },
                await ph.allCommands(client),
            ));
            return interaction.replyOptions({ embeds: [helpEmbed] });
        }

        const command = keys.data[commandName];
        if(!command) {
            const commands = client.commands.filter(c => c.category === commandName);

            //Show command list of category
            if(!commands.size) {
                return interaction.replyTl(keys.commands.help.warnings.command_does_not_exist, { 'command_name': commandName.toTitleCase() });
            }

            for(let command of commands.values()) {
                command = keys.data[command.name];

                helpEmbed.addFields(addPh(
                    keys.commands.help.success.category.embeds[0].fields[0],
                    await ph.commandName(command.name, client),
                    { 'command_description': command.description },
                ));
            }

            helpEmbed.addFields(addPh(
                keys.commands.help.success.category.embeds[0].fields[1],
                { 'invite_link': process.env.DISCORD_LINK },
            ));

            return interaction.replyOptions({ embeds: [helpEmbed] });
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
                    'invite_link': process.env.DISCORD_LINK,
                },
                await ph.commandName(commandName, client),
            ));
            return interaction.replyOptions({ embeds: [helpEmbed] });

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
