import Component from '../Component.js';
import { ButtonInteraction, InteractionCollector, InteractionType } from 'discord.js';

export default class DefaultButton extends Component {

    /**
     * @typedef {ComponentOptions & { type: InteractionType.MessageComponent }} DefaultButtonOptions
     * @property {?InteractionCollector} collector - An optional collector that will be used to trigger this button.
     */

    /**
     * @param {DefaultButtonOptions} options - The options for this button
     * @param {Function} handler
     */
    constructor(options, handler) {
        super(Object.assign(options, { type: 'Button' }));

        /**
         * The handler of this button.
         * @type {Function}
         */
        this.handler = handler;

        /**
         * The collector of this button.
         * @type {?InteractionCollector}
         */
        this.collector = options.collector ?? null;

        this.collector?.on('collect', interaction => {
            if(interaction.customId === this.id && interaction instanceof ButtonInteraction) {
                this.execute(interaction, interaction.client);
            }
        });
    }

    /** @inheritdoc */
    async run(interaction, client, server, logger) {
        return await this.handler(interaction, client, server, logger);
    }
}
