const { AutocompleteInteraction } = require('discord.js');
const Command = require('./Command');

class AutocompleteCommand extends Command {

    /**
     * @inheritDoc
     * @returns {void}
     * @abstract
     */
    execute(interaction, args) {
        throw new Error('Not implemented');
    }

    /**
     * Handles the autocompletion of a command.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @returns {void}
     * @abstract
     */
    autocomplete(interaction) {
        throw new Error('Not implemented');
    }

}

module.exports = AutocompleteCommand;
