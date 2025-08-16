import { ComponentType, MessageFlags } from 'discord.js';
import { createActionRows, getComponent } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import { disableComponents, flattenActionRows } from '../../utilities/utils.js';
import DefaultButton from './DefaultButton.js';

export default class Wizard {

    static DEFAULT_TIMEOUT = 120_000;

    static NAVIGATION_BUTTON_IDS = {
        NEXT: 'wizard_next',
        BACK: 'wizard_back',
    };

    /**
     * @typedef {Object} WizardOptions
     * @property {number} [timeout=120000] - The timeout for the buttons of the pagination in ms
     * @property {import('discord.js').ButtonBuilder} [nextButton] - The button to use for going to the next page
     * @property {import('discord.js').ButtonBuilder} [backButton] - The button to use for going to the previous page
     * @property {boolean} [ephemeral=false] - Whether the interaction should be ephemeral
     */

    /**
     * @param {MCLinker} client - Discord client
     * @param {(Message|import('discord.js').BaseInteraction) & TranslatedResponses} interaction - The interaction to handle
     * @param {Array<import('discord.js').BaseMessageOptions>} pages - Array of pages (MessageOptions)
     * @param {Object} [options] - Additional options
     * @param {WizardOptions} [options] - Timeout in milliseconds for the wizard
     */
    constructor(client, interaction, pages, options = {}) {
        this.client = client;
        this.interaction = interaction;
        this.pages = pages;
        this.options = {
            timeout: Wizard.DEFAULT_TIMEOUT,
            nextButton: getComponent(keys.api.component.success.next_button, { id: Wizard.NAVIGATION_BUTTON_IDS.NEXT }),
            backButton: getComponent(keys.api.component.success.back_button, { id: Wizard.NAVIGATION_BUTTON_IDS.BACK }),
            ...options,
        };

        this.currentPage = 0;
        this.message = null;
        this.collector = null;

        this.buttons = new Map();

        const navigationButtons = [
            { button: this.options.nextButton, handler: this._handleNextButton.bind(this) },
            { button: this.options.backButton, handler: this._handleBackButton.bind(this) },
        ];

        navigationButtons.forEach(({ button, handler }) => {
            this.buttons.set(button.data.custom_id, new DefaultButton({
                id: button.data.custom_id,
                author: this.interaction.user,
                defer: true,
            }, handler));
        });
    }

    /**
     * Starts the wizard and shows the first page
     * @return {Promise<Message>} - The message containing the first page
     */
    async start() {
        return await this._showPage(0, true);
    }

    /**
     * Shows a specific page
     * @param {number} pageIndex - Index of the page
     * @param {boolean} [initial=false] - Whether this is the first display
     * @return {Promise<Message>} - The message containing the page
     * @private
     */
    async _showPage(pageIndex, initial = false) {
        this.currentPage = pageIndex;
        const page = this.pages[pageIndex];
        const components = this._getActionRows(page);
        const options = { ...page, components, flags: this.options.ephemeral ? MessageFlags.Ephemeral : 0 };

        if(initial) {
            this.message = await this.interaction.replyOptions(options);
            this._createCollector();
        }
        else await this.message.edit(options);

        return this.message;
    }

    /**
     * Creates the ActionRows with the buttons
     * @param {import('discord.js').BaseMessageOptions} page - The page with additional components
     * @return {import('discord.js').ActionRowBuilder[]} - Array of ActionRows with buttons
     * @private
     */
    _getActionRows(page) {
        const buttons = [];
        if(this.currentPage > 0) buttons.push(this.options.backButton);
        if(this.currentPage < this.pages.length - 1) buttons.push(this.options.nextButton);

        // Merge the buttons with the existing components if any
        if(page && page.components) buttons.push(...flattenActionRows(page.components));

        return createActionRows(buttons);
    }

    /**
     * Creates the collector for button interactions
     * @private
     */
    _createCollector() {
        this.collector = this.message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: this.options.timeout,
        });
        this.collector.on('collect', interaction => this.buttons.get(interaction.customId)?.execute(interaction, this.client));
        this.collector.on('end', async () => {
            this.message = await this.message.fetch(); // Get the latest components
            await this.message.edit({ components: disableComponents(this.message.components) });
        });
    }

    /**
     * Handles the next button click
     * @param {import('discord.js').ButtonInteraction} _ - The interaction of the button
     * @return {Promise<Message>} - The message containing the next page
     * @private
     */
    _handleNextButton(_) {
        return this._showPage(this.currentPage + 1);
    }

    /**
     * Handles the back button click
     * @param {import('discord.js').ButtonInteraction} _ - The interaction of the button
     * @return {Promise<Message>} - The message containing the previous page
     * @private
     */
    _handleBackButton(_) {
        return this._showPage(this.currentPage - 1);
    }
}
