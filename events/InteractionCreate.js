import Event from '../structures/Event.js';
import { addTranslatedResponses } from '../utilities/messages.js';
import { getArgs } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import AutocompleteCommand from '../structures/AutocompleteCommand.js';
import logger from '../utilities/logger.js';
import { ComponentType, InteractionType } from 'discord.js';

/**
 * Handles the Discord interactionCreate event for the MC-Linker bot.
 * Processes slash commands, autocomplete, and button interactions.
 */
export default class InteractionCreate extends Event {
    constructor() {
        super({
            name: 'interactionCreate',
        });
    }

    /**
     * @inheritDoc
     * @param {MCLinker} client
     * @param {import('discord.js').BaseInteraction} interaction
     */
    async execute(client, interaction) {
        interaction = addTranslatedResponses(interaction);
        if(interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if(!command.allowUser && !interaction.inGuild()) return interaction.replyTl(keys.main.no_access.not_in_guild);
            const args = await getArgs(interaction);
            const server = client.serverConnections.cache.get(interaction.guildId);
            try {
                await command.execute(interaction, client, args, server);
            }
            catch(err) {
                logger.error(err, `Could not execute command ${interaction.name}`);
                await interaction.replyTl(keys.main.errors.could_not_execute_command);
            }
        }
        else if(interaction.isAutocomplete()) {
            if(!interaction.inGuild()) return;
            const command = client.commands.get(interaction.commandName);
            try {
                if(!command || !(command instanceof AutocompleteCommand)) return;
                await command.autocomplete(interaction, client);
            }
            catch(err) {
                logger.error(err, `Could not autocomplete command ${interaction.commandName}`);
            }
        }
        else if(interaction.isMessageComponent() || interaction.isModalSubmit()) {
            const component = this.getComponentForInteraction(client, interaction);
            if(!component) return;

            try {
                await component.execute(interaction, client);
            }
            catch(err) {
                logger.error(err, `Could not execute component ${interaction.customId}`);
                await interaction.replyTl(keys.main.errors.could_not_execute_button);
            }
        }
    }

    getComponentForInteraction(client, interaction) {
        let component = client.components.get(interaction.customId);
        if(!component) return;
        // js enum check
        if(ComponentType[component.type])
            return interaction.isMessageComponent() && interaction.componentType === ComponentType[component.type] ?
                component : null;
        else if(InteractionType[component.type])
            return interaction.type === InteractionType[component.type] ?
                component : null;
    }
} 