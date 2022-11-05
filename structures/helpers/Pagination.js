const {
    ButtonBuilder,
    BaseMessageOptions,
    BaseInteraction,
} = require('discord.js');
const utils = require('../../api/messages');
const DefaultButton = require('../DefaultButton');

class Pagination {

    /**
     * @typedef {Object} PaginationOptions
     * @property {ButtonBuilder} [nextButton] - The button to use for going to the next page
     * @property {ButtonBuilder} [previousButton] - The button to use for going to the previous page
     */

    /**
     * @typedef  {Object} PaginationPage
     * @property {ButtonBuilder} button - The button that points to this page
     * @property {BaseMessageOptions} page - The page to send
     * @property {boolean} [startPage=false] - Whether this is the starting page
     */

    /**
     *  @typedef {Object.<string, PaginationPage>} PaginationPages
     */

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
         * An object of pages that will be used for the pagination
         * @type {PaginationPages}
         */
        this.pages = pages;

        /**
         * The options for this pagination
         * @type {PaginationOptions}
         */
        this.options = options;

        /**
         * The last button that was used
         * @type {?ButtonBuilder}
         */
        this.previousButton = null;
    }

    /**
     * Starts the pagination interaction
     * @returns {Promise<void>}
     */
    async start() {
        /** @type {ButtonBuilder[]} */
        const buttons = Object.values(this.pages).map(page => page.button);
        const { button: startingButton, page: startingPage } = Object.values(this.pages).find(page => page.startPage);
        if(!startingPage) return;

        const allComponents = [];
        startingPage.components?.forEach(component => allComponents.push(...component.components));
        allComponents.push(...buttons);

        //Add buttons to the client handler
        buttons.forEach(button => {
            this.client.buttons.set(button.data.custom_id, new DefaultButton({
                id: button.data.custom_id,
                author: this.interaction.user,
            }, this.handleButton.bind(this)));
        });

        const oldComponents = startingPage.components ?? []; //Save old components
        //Send starting message
        startingPage.components = utils.createActionRows(allComponents);
        await this.interaction.replyOptions(startingPage);
        startingPage.components = oldComponents; //Reset components

        //Set previous button
        this.previousButton = startingButton;
    }

    async handleButton(interaction) {
        const page = this.pages[interaction.customId]?.page;
        if(!page) return;

        //Edit message with new page
        const allComponents = [];
        page.components?.forEach(component => allComponents.push(...component.components));
        Object.values(this.pages).forEach(page => {
            if(page.button.data.custom_id !== interaction.customId) allComponents.push(page.button);
        });

        const oldComponents = page.components ?? []; //Save old components
        page.components = utils.createActionRows(allComponents);
        page.files ??= [];
        await interaction.update(page);
        page.components = oldComponents; //Reset components
    }
}

module.exports = Pagination;
