import Event from '../structures/Event.js';
import { addTranslatedResponses } from '../utilities/messages.js';
import { getArgs } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import AutocompleteCommand from '../structures/AutocompleteCommand.js';
import { ComponentType, Events, InteractionType } from 'discord.js';

/**
 * Handles the Discord interactionCreate event for the MC-Linker bot.
 * Processes slash commands, autocomplete, and button interactions.
 */
export default class InteractionCreate extends Event {
    constructor() {
        super({
            name: Events.InteractionCreate,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').BaseInteraction]} args - [0] The interaction.
     * @param logger
     */
    async run(client, [interaction], logger) {
        interaction = addTranslatedResponses(interaction);
        if(interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            const args = await getArgs(interaction);
            const server = client.serverConnections.cache.get(interaction.guildId);
            const startTime = Date.now();
            try {
                await command.execute(interaction, client, args, server);
                client.analytics.trackCommand(interaction.commandName, interaction.guildId, interaction.user.id, Date.now() - startTime, true);
            }
            catch(err) {
                client.analytics.trackCommand(interaction.commandName, interaction.guildId, interaction.user.id, Date.now() - startTime, false);
                client.analytics.trackError('command', interaction.commandName, interaction.guildId, interaction.user.id, err, null, logger);
                await interaction.editReplyTl(keys.main.errors.could_not_execute_command);
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
                client.analytics.trackError('command', interaction.commandName, interaction.guildId, interaction.user.id, err, null, logger);
            }
        }
        else if(interaction.isMessageComponent() || interaction.isModalSubmit()) {
            const component = this.getComponentForInteraction(client, interaction);
            if(!component) return;

            const startTime = Date.now();
            try {
                await component.execute(interaction, client);
                client.analytics.trackComponent(interaction.customId, interaction.guildId, interaction.user.id, Date.now() - startTime, true);
            }
            catch(err) {
                client.analytics.trackComponent(interaction.customId, interaction.guildId, interaction.user.id, Date.now() - startTime, false);
                client.analytics.trackError('component', interaction.customId, interaction.guildId, interaction.user.id, err, null, logger);
                await interaction.editReplyTl(keys.main.errors.could_not_execute_button);
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