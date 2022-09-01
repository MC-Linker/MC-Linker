class Command {

    /**
     * The name of a command.
     * @type {string}
     * @abstract
     */
    name;

    /**
     * Handles the execution of a command.
     * @param {Message|CommandInteraction} interaction - The message/slash command interaction
     * @param {String[]} args - The command arguments set by the user
     * @returns {void}
     * @abstract
     */
    execute(interaction, args) {
        throw new Error('Not implemented');
    }
}

module.exports = Command;
