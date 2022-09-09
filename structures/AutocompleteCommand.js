const { AutocompleteInteraction, CommandInteraction } = require('discord.js');
const Command = require('./Command');

class AutocompleteCommand extends Command {

    /**
     * @inheritDoc
     * @param {Message|CommandInteraction} interaction - The message/slash command interaction
     * @param {MCLinker} client - The MCLinker client
     * @param {String[]} args - The command arguments set by the user
     * @returns {void|Promise<void>}
     * @abstract
     */
    execute(interaction, client, args) {
        throw new Error('Not implemented');
    }

    /**
     * Handles the autocompletion of a command.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @param {MCLinker} client - The MCLinker client
     * @returns {void|Promise<void>}
     * @abstract
     */
    autocomplete(interaction, client) {
        throw new Error('Not implemented');
    }

}

module.exports = AutocompleteCommand;
