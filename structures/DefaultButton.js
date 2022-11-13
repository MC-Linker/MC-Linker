const Button = require('./Button');

class DefaultButton extends Button {

    /**
     * @param {ButtonOptions} options - The options for this button
     * @param {Function} handler
     */
    constructor(options, handler) {
        super(options);

        /**
         * The handler of this button.
         */
        this.handler = handler;
    }

    async execute(interaction, client, server) {
        if(!await super.execute(interaction, client, server)) return;
        return await this.handler(interaction, client, server);
    }
}

module.exports = DefaultButton;
