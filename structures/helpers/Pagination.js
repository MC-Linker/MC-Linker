import {
    BaseInteraction,
    ButtonBuilder,
    ComponentType,
    InteractionCollector,
    InteractionResponse,
    Message,
} from 'discord.js';
import DefaultButton from './DefaultButton.js';
import { createActionRows, getComponent } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import { ComponentSizeInActionRow, disableComponents, MaxActionRows, MaxActionRowSize } from '../../utilities/utils.js';

export default class Pagination {

    static DEFAULT_TIMEOUT = 120_000;

    static NAVIGATION_BUTTON_IDS = {
        NEXT: 'next',
        BACK: 'back',
        EXIT: 'exit',
    };

    /**
     * @typedef {Object} PaginationOptions
     * @property {ButtonBuilder} [nextButton] - The button to use for going to the next page
     * @property {ButtonBuilder} [backButton] - The button to use for going to the previous page
     * @property {ButtonBuilder} [exitButton] - The button to use for exiting the nested pagination
     * @property {boolean} [showSelectedButton=true] - Whether the currently selected button should be shown
     * @property {boolean} [showStartPageOnce=false] - Whether the starting page should only be shown once (removes the button)
     * @property {number} [timeout=120000] - The timeout for the buttons of the pagination in ms
     * @property {Pagination} [parent] - The parent of this pagination (only used for nested paginations)
     * @property {ButtonStyle} [highlightSelectedButton] - The style to use for the selected button
     */

    /**
     * @typedef  {Object} PaginationPage
     * @property {ButtonBuilder} [button] - The button that points to this page
     * @property {import('discord.js').BaseMessageOptions} [options] - The message options to send
     * @property {PaginationPages} [pages] - The pages to send (for nested pagination)
     * @property {boolean} [startPage=false] - Whether this is the starting page
     * @property {PaginationOptions} [pageOptions] - The options for this page (for nested pagination)
     * @property {ComponentOptions} [buttonOptions] - Additional options that will be passed to the constructor of the button
     */

    /**
     *  @typedef {Object.<string, PaginationPage>} PaginationPages - An object of custom IDs to PaginationPage objects
     */

    /**
     * The last page that was sent in this pagination
     * @type {PaginationPage}
     * @private
     */
    lastPage;

    /**
     * The last message options that were sent
     * @type {import('discord.js').BaseMessageOptions}
     * @private
     */
    lastMessageOptions;

    /**
     * The index of the last first page button in the components array
     * @type {number}
     * @private
     */
    lastFirstPageButtonIndex;

    /**
     * The collector for the buttons of this pagination that is currently running
     * @type {?InteractionCollector}
     */
    collector;

    /**
     * @param {MCLinker} client - The client of this pagination
     * @param {(Message|BaseInteraction) & TranslatedResponses} interaction - The interaction to create the pagination for
     * @param {PaginationPages} pages - An object of pages that will be used for the pagination
     * @param {PaginationOptions} options - The options for this pagination
     */
    constructor(client, interaction, pages, options = {}) {

        /**
         * The client of this pagination
         * @type {MCLinker}
         */
        this.client = client;

        /**
         * The interaction to create the pagination for
         * @type {(Message|BaseInteraction) & TranslatedResponses}
         */
        this.interaction = interaction;

        /**
         * An object of pages that are used for the pagination
         * @type {PaginationPages}
         */
        this.pages = pages;

        /**
         * A map of button instances that are used in this pagination
         * @type {Map<string, DefaultButton>}
         */
        this.buttons = new Map();

        /**
         * The options for this pagination
         * @type {PaginationOptions}
         */
        this.options = this._initializeOptions(options);

        /**
         * The parent pagination if this is a nested pagination
         * @type {Pagination|null}
         */
        this.parent = this.options.parent ?? null;

        this._registerPageButtons();
        this._registerNavigationButtons();
    }

    /**
     * Initialize default options for pagination
     * @private
     * @param {PaginationOptions} options - The options to initialize
     * @return {PaginationOptions} - The initialized options with defaults applied
     */
    _initializeOptions(options) {
        return {
            nextButton: getComponent(keys.api.component.success.next_button, { id: Pagination.NAVIGATION_BUTTON_IDS.NEXT }),
            backButton: getComponent(keys.api.component.success.back_button, { id: Pagination.NAVIGATION_BUTTON_IDS.BACK }),
            exitButton: getComponent(keys.api.component.success.exit_button, { id: Pagination.NAVIGATION_BUTTON_IDS.EXIT }),
            timeout: Pagination.DEFAULT_TIMEOUT,
            showSelectedButton: true,
            showStartPageOnce: false,
            ...options,
        };
    }


    /**
     * Register page buttons with their handlers
     * @private
     */
    _registerPageButtons() {
        Object.entries(this.pages).forEach(([customId, page]) => {
            if(!(page.button instanceof ButtonBuilder)) return;
            if(page.startPage && this.options.showStartPageOnce) return;

            this.buttons.set(customId, new DefaultButton({
                id: customId,
                author: this.interaction.user,
                defer: false,
                ...page.buttonOptions,
            }, this._handleButton.bind(this)));
        });
    }

    /**
     * Register navigation buttons (next, back, exit)
     * @private
     */
    _registerNavigationButtons() {
        const navigationButtons = [
            { button: this.options.nextButton, handler: this._handleNextButton.bind(this) },
            { button: this.options.backButton, handler: this._handleBackButton.bind(this) },
            { button: this.options.exitButton, handler: this._handleExitButton.bind(this) },
        ];

        navigationButtons.forEach(({ button, handler }) => {
            this.buttons.set(button.data.custom_id, new DefaultButton({
                id: button.data.custom_id,
                author: this.interaction.user,
                defer: false,
            }, handler));
        });
    }

    /**
     * Get starting page data
     * @private
     * @return {PaginationPage} - Contains the button and page for the starting page
     */
    _getStartPage() {
        // Make sure to return a reference
        let startPageId = Object.entries(this.pages).find(([_, page]) => page.startPage)?.[0] ?? Object.keys(this.pages)[0];
        return this.pages[startPageId];
    }

    /**
     * Get all page buttons
     * @private
     * @return {ButtonBuilder[]} - An array of buttons for all pages
     */
    _getPageButtons() {
        return Object.values(this.pages).map(page => page.button).filter(Boolean);
    }

    /**
     * Starts the pagination interaction
     * @returns {Promise<Message|InteractionResponse>} - The message that was sent
     */
    async start() {
        this.lastFirstPageButtonIndex = 0;

        const message = await this._sendInitialMessage();
        this._createComponentCollector(message);
        return message;
    }

    /**
     * Create a component collector for the pagination buttons
     * @param {Message|InteractionResponse} message - The message to create the collector for
     * @private
     */
    _createComponentCollector(message) {
        this.collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: this.options.timeout ?? Pagination.DEFAULT_TIMEOUT,
        });
        this.collector.on('collect', interaction => this.buttons.get(interaction.customId)?.execute(interaction, this.client));
        this.collector.on('end', async (_, reason) => {
            if(['nested_pagination', 'exit_to_parent'].includes(reason)) return;

            message = await message.fetch(); // Get the latest components
            if(!message?.components) return;

            await message.edit({ components: disableComponents(message.components) });
        });
    }

    /**
     * Send the initial message
     * @returns {Promise<Message|InteractionResponse>} - The message that was sent
     * @private
     */
    async _sendInitialMessage() {
        const startPage = this._getStartPage();
        const options = startPage.options;

        const components = this._getReplyRows(startPage.options, startPage.button?.data?.custom_id, 'stay');

        this.lastPage = startPage;
        this.lastMessageOptions = { ...options, components };

        const message = await this.interaction.replyOptions(this.lastMessageOptions);
        return message;
    }

    /**
     * Handle next button interaction
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} interaction - The interaction to handle
     * @private
     */
    async _handleNextButton(interaction) {
        const rows = this._getReplyRows(this.lastPage, null, 'next');
        await interaction.update({ components: rows });
    }

    /**
     * Handle back button interaction
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} interaction - The interaction to handle
     * @private
     */
    async _handleBackButton(interaction) {
        const rows = this._getReplyRows(this.lastPage, null, 'back');
        await interaction.update({ components: rows });
    }

    /**
     * Handle exit button for nested pagination
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} interaction - The interaction to handle
     * @private
     */
    async _handleExitButton(interaction) {
        if(!this.parent) return;

        await interaction.deferUpdate();
        this.collector?.stop('exit_to_parent');
        this.collector = null;

        // Return to parent pagination
        const message = await this.parent.interaction.replyOptions(this.parent.lastMessageOptions);
        return this.parent._createComponentCollector(message);
    }

    /**
     * Handles a button interaction
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} interaction - The button interaction to handle
     * @private
     */
    async _handleButton(interaction) {
        const page = this.pages[interaction.customId];
        if(!page) return;

        // Handle nested pagination
        if(page.pages) return await this._handleNestedPagination(interaction, page);

        // Handle regular page navigation
        await this._navigateToPage(interaction, page);
    }

    /**
     * Handle nested pagination
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} interaction - The interaction to handle
     * @param {PaginationPage} pageData - The page data for the nested pagination
     * @returns {Promise<Message|InteractionResponse>} - The message that was sent for the nested pagination
     * @private
     */
    async _handleNestedPagination(interaction, pageData) {
        await interaction.deferUpdate();

        const nestedPagination = new Pagination(this.client, this.interaction, pageData.pages, {
            ...this.options,
            ...pageData.pageOptions,
            parent: this,
        });

        this.collector.stop('nested_pagination');
        this.collector = null;
        return await nestedPagination.start();
    }

    /**
     * Navigate to a specific page
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} interaction - The interaction to handle
     * @param {PaginationPage} page - The page data to navigate to
     * @private
     */
    async _navigateToPage(interaction, page) {
        const options = page.options;

        const components = this._getReplyRows(options, page.button.data.custom_id, 'stay');
        this.lastPage = { button: page.button, options };
        this.lastMessageOptions = { ...options, components };

        await interaction.update(this.lastMessageOptions);
    }

    /**
     * Hides or highlights the selected button based on options
     * @param {ButtonBuilder[]} components - The components to update
     * @param {string} selectedButtonId - The ID of the selected button
     * @return {ButtonBuilder[]} - The updated components with the selected button handled
     * @private
     */
    _updateSelectedButtonStyle(components, selectedButtonId) {
        const selectedButtonIndex = components.findIndex(b => b.data.custom_id === selectedButtonId);
        if(selectedButtonIndex === -1) return components;
        if(!this.options.showSelectedButton) components.splice(selectedButtonIndex, 1);
        else if(this.options.highlightSelectedButton) {
            components[selectedButtonIndex] = ButtonBuilder.from(components[selectedButtonIndex].data)
                .setStyle(this.options.highlightSelectedButton);
        }
        return components;
    }

    /**
     * Gets the index of the first button in the message components that is also a page button
     * @param {Message} message - The message containing the components
     * @return {number} - The index of the first button in the message components that is also a page button
     * @private
     */
    _getFirstPageButtonIndex(message) {
        const allButtonIds = this._getPageButtons().map(b => b.data.custom_id);
        const allComponentIds = this._flattenActionRows(message.components).map(c => c.data.custom_id);
        return allButtonIds.findIndex(id => allComponentIds.includes(id));
    }

    /**
     * Get the action rows to reply for the current page
     * @param {import('discord.js').BaseMessageOptions} options - The options object containing components
     * @param {?string} selectedButtonId - The ID of the currently selected button
     * @param {'next'|'back'|'stay'} direction - The direction of navigation
     * @return {import('discord.js').ActionRowBuilder[]} - The action rows to reply with
     * @private
     */
    _getReplyRows(options, selectedButtonId, direction) {
        let pageButtons = this._getPageButtons();

        let navButtons = [];
        if(this.parent) navButtons.push(this.options.exitButton);

        let spaceLeft = this._countActionRowSpace(this._combineComponents(options, navButtons));

        const calcNewFirstPageButtonIndex = () => {
            let newFirstPageButtonIndex;
            if(direction === 'next') newFirstPageButtonIndex = this.lastFirstPageButtonIndex + spaceLeft;
            else if(direction === 'back') newFirstPageButtonIndex = this.lastFirstPageButtonIndex - spaceLeft;
            else if(direction === 'stay') newFirstPageButtonIndex = this.lastFirstPageButtonIndex;
            return newFirstPageButtonIndex;
        };

        let newFirstPageButtonIndex = calcNewFirstPageButtonIndex();

        // If we're not going to the last button page (i.e. theres not enough space to add all buttons), add the next button
        if(newFirstPageButtonIndex + spaceLeft < pageButtons.length) {
            navButtons.push(this.options.nextButton);
            spaceLeft--;
            newFirstPageButtonIndex = calcNewFirstPageButtonIndex();
        }

        // If we're not going to the first button page, add the back button
        if(newFirstPageButtonIndex > 0) {
            navButtons.push(this.options.backButton);
            spaceLeft--;
            newFirstPageButtonIndex = calcNewFirstPageButtonIndex();
        }

        if(direction === 'next' || direction === 'stay') pageButtons = pageButtons.slice(newFirstPageButtonIndex, newFirstPageButtonIndex + spaceLeft);
        else if(direction === 'back') pageButtons = pageButtons.slice(newFirstPageButtonIndex, this.lastFirstPageButtonIndex);

        this.lastFirstPageButtonIndex = newFirstPageButtonIndex;

        if(selectedButtonId) this._updateSelectedButtonStyle(pageButtons, selectedButtonId);

        return createActionRows(this._combineComponents(options, [...pageButtons, ...navButtons]));
    }

    /**
     * Counts how much space is left in an action row for components
     * @param {import('discord.js').ComponentBuilder[]} components - The components already in the action row
     * @return {number} - The amount of space left in the action row
     * @private
     */
    _countActionRowSpace(components) {
        const maxSpace = MaxActionRows * MaxActionRowSize;
        return maxSpace - components.reduce((acc, component) => acc + ComponentSizeInActionRow[component.data.type], 0);
    }

    /**
     * Combine action rows of options with page buttons
     * @param {import('discord.js').BaseMessageOptions} options - The options object containing action rows
     * @param {ButtonBuilder[]} pageButtons - Page Buttons to add
     * @returns {import('discord.js').ComponentBuilder[]} - Combined components for the page
     */
    _combineComponents(options, pageButtons) {
        return [...this._flattenActionRows(options.components), ...pageButtons];
    }

    /**
     * Flatten action rows to get all components
     * @param {import('discord.js').ActionRowBuilder[]} actionRows - The action rows to flatten
     * @return {import('discord.js').ComponentBuilder[]} - An array of all components in the action rows
     * @private
     */
    _flattenActionRows(actionRows) {
        return actionRows?.flatMap(row => row.components) ?? [];
    }
}
