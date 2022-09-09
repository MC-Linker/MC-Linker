const { CommandInteraction, Message } = require('discord.js');

class Command {

    constructor(name) {
        /**
         * The name of this command.
         * @type {string}
         * @abstract
         */
        this.name = name;
    }

    /**
     * Handles the execution of a command.
     * @param {Message|CommandInteraction} interaction - The message/slash command interaction
     * @param {String[]} args - The command arguments set by the user
     * @returns {Promise<void>}
     * @abstract
     */
    async execute(interaction, args) {
        throw new Error('Not implemented');
    }
}

module.exports = Command;
