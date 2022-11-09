const {
    ButtonBuilder,
    BaseMessageOptions,
    BaseInteraction, ComponentType, ActionRowBuilder,
} = require('discord.js');
const utils = require('../../api/messages');
const DefaultButton = require('../DefaultButton');

class Pagination {

    /**
     * @typedef {Object} PaginationOptions
     * @property {ButtonBuilder} [nextButton] - The button to use for going to the next page
     * @property {ButtonBuilder} [previousButton] - The button to use for going to the previous page
     * @property {number} [timeout=120000] - The timeout for the buttons of the pagination in ms
     */

    /**
     * @typedef  {Object} PaginationPage
     * @property {ButtonBuilder} button - The button that points to this page
     * @property {BaseMessageOptions} page - The page to send
     * @property {boolean} [startPage=false] - Whether this is the starting page
     * @property {ButtonOptions} [buttonOptions] - Additional options that will be passed to the constructor of the button
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
    }

    /**
     * Starts the pagination interaction
     * @returns {Promise<void>}
     */
    async start() {
        /** @type {ButtonBuilder[]} */
        const {
            button: startingButton,
            page: startingPage,
        } = Object.values(this.pages).find(page => page.startPage) ?? Object.values(this.pages)[0];
        const buttons = Object.values(this.pages).map(page => page.button);
        if(!startingPage) return;

        //Map custom ids of buttons to default button instances
        /** @type {Collection<string, DefaultButton>} */
        const buttonInstances = new Map();
        buttons.forEach(button => {
            buttonInstances.set(button.data.custom_id, new DefaultButton({
                id: button.data.custom_id,
                author: this.interaction.user,
                defer: false,
                ...Object.values(this.pages).find(page => page.button.data.custom_id === button.data.custom_id)?.buttonOptions,
            }, this.handleButton.bind(this)));
        });

        //Remove starting button
        buttons.splice(buttons.indexOf(startingButton), 1);

        const allComponents = [];
        startingPage.components?.forEach(component => allComponents.push(...component.components));
        allComponents.push(...buttons);

        const oldComponents = startingPage.components ?? []; //Save old components
        //Send starting message
        startingPage.components = utils.createActionRows(allComponents);
        const message = await this.interaction.replyOptions(startingPage);
        startingPage.components = oldComponents; //Reset components

        //Create  button collector
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: this.options.timeout ?? 120_000,
        });
        collector.on('collect', interaction => buttonInstances.get(interaction.customId).execute(interaction, this.client, null));
        collector.on('end', () => {
            //Disable all components in current message
            const components = message.components.map(row => {
                row = ActionRowBuilder.from(row);
                const disabledComponents = row.components.map(component => component.setDisabled(true));
                row.setComponents(...disabledComponents);
                return row;
            });
            message.edit({ components });
        });
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
