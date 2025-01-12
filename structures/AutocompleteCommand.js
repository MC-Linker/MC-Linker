import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import Command from './Command.js';

export default class AutocompleteCommand extends Command {

    /**
     * @inheritDoc
     * @param {(Message|CommandInteraction) & TranslatedResponses} interaction - The message/slash command interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {any[]} args - The command arguments set by the user.
     * @param {?ServerConnection} serverConnection - The connection of the server the command was executed in.
     * @returns {Promise<?boolean>|?boolean}
     * @abstract
     */
    execute(interaction, client, args, serverConnection) {
        return super.execute(interaction, client, args, serverConnection);
    }

    /**
     * Handles the autocompletion of a command.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {?ServerData} server - The server the command was executed in.
     * @returns {void|Promise<void>}
     * @abstract
     */
    autocomplete(interaction, client, server = null) {
        throw new Error('Not implemented');
    }

}
