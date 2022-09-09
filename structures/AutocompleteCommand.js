const { AutocompleteInteraction } = require('discord.js');
const Command = require('./Command');

class AutocompleteCommand extends Command {

    /**
     * @inheritDoc
     * @abstract
     */
    async execute(interaction, args) {
        throw new Error('Not implemented');
    }

    /**
     * Handles the autocompletion of a command.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @returns {Promise<void>}
     * @abstract
     */
    async autocomplete(interaction) {
        throw new Error('Not implemented');
    }

}

module.exports = AutocompleteCommand;
