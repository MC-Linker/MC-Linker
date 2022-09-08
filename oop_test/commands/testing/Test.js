const AutocompleteCommand = require('../../structures/AutocompleteCommand');

class Test extends AutocompleteCommand {

    constructor() {
        super('test');
    }


    autocomplete(interaction) {
    }

    execute(interaction, args) {
    }
}

module.exports = Test;
