import {
    ActionRowBuilder,
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
import { disableComponents } from '../../utilities/utils.js';

export default class Pagination {

    /**
     * @typedef {Object} PaginationOptions
     * @property {ButtonBuilder} [nextButton] - The button to use for going to the next page
     * @property {ButtonBuilder} [backButton] - The button to use for going to the previous page
     * @property {ButtonBuilder} [exitButton] - The button to use for exiting the nested pagination
     * @property {boolean} [showSelectedButton=false] - Whether the currently selected button should be shown
     * @property {boolean} [showStartPageOnce=false] - Whether the starting page should only be shown once (removes the button)
     * @property {number} [timeout=120000] - The timeout for the buttons of the pagination in ms
     * @property {Pagination} [parent=null] - The parent of this pagination (only used for nested paginations)
     */

    /**
     * @typedef  {Object} PaginationPage
     * @property {ButtonBuilder} [button] - The button that points to this page
     * @property {import('discord.js').BaseMessageOptions} [page] - The page to send
     * @property {PaginationPages} [pages] - The pages to send (for nested pagination)
     * @property {boolean} [startPage=false] - Whether this is the starting page
     * @property {PaginationOptions} [pageOptions] - The options for this page (for nested pagination)
     * @property {ButtonOptions} [buttonOptions] - Additional options that will be passed to the constructor of the button
     */

    /**
     *  @typedef {Object.<string, PaginationPage>} PaginationPages
     */

    /**
     * The last page that was sent in this pagination
     * @type {PaginationPage}
     */
    lastPage;

    /**
     * The last message options that were sent
     * @type {import('discord.js').BaseMessageOptions}
     */
    lastMessageOptions;

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
         * An object of pages that will be used for the pagination
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
        this.options = options;
        if(!(this.options.nextButton instanceof ButtonBuilder)) this.options.nextButton = getComponent(keys.api.button.success.next_button, { id: 'next' });
        if(!(this.options.backButton instanceof ButtonBuilder)) this.options.backButton = getComponent(keys.api.button.success.back_button, { id: 'back' });
        if(!(this.options.exitButton instanceof ButtonBuilder)) this.options.exitButton = getComponent(keys.api.button.success.exit_button, { id: 'exit' });

        /**
         * The parent of this pagination (only used for nested paginations)
         * @type {?Pagination}
         */
        this.parent = this.options.parent ?? null;

        //Register next and back buttons
        this.buttons.set(this.options.nextButton.data.custom_id, new DefaultButton({
            id: this.options.nextButton.data.custom_id,
            author: this.interaction.user,
            defer: false,
        }, this._handleNextButton.bind(this)));
        this.buttons.set(this.options.backButton.data.custom_id, new DefaultButton({
            id: this.options.nextButton.data.custom_id,
            author: this.interaction.user,
            defer: false,
        }, this._handleBackButton.bind(this)));
        this.buttons.set(this.options.exitButton.data.custom_id, new DefaultButton({
            id: this.options.exitButton.data.custom_id,
            author: this.interaction.user,
            defer: false,
        }, this._handleExitButton.bind(this)));
    }

    /**
     * Starts the pagination interaction
     * @returns {Promise<Message|InteractionResponse>} - The message that was sent
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
        buttons.forEach((button, i) => {
            if(!(button instanceof ButtonBuilder)) return;
            this.buttons.set(button.data.custom_id, new DefaultButton({
                id: button.data.custom_id,
                author: this.interaction.user,
                defer: false,
                ...Object.values(this.pages)[i].buttonOptions,
            }, this._handleButton.bind(this)));
        });
        //Remove starting button only if selected button should not be shown or if the start page should only be shown once
        if(!this.options.showSelectedButton || this.options.showStartPageOnce) buttons.splice(buttons.indexOf(startingButton), 1);
        // Remove starting button if it should only be shown once
        if(this.options.showStartPageOnce) this.buttons.delete(startingButton?.data?.custom_id);

        //Set last page and message options
        this.lastPage = { button: startingButton, page: startingPage };

        //Send starting message
        const oldComponents = startingPage.components ?? []; //Save old components
        startingPage.components = this.combineComponents(startingPage, buttons);

        this.lastMessageOptions = { ...startingPage };
        const message = await this.interaction.replyOptions(startingPage);
        startingPage.components = oldComponents; //Reset components

        //Create button collector
        this._createComponentCollector(message);
        return message;
    }

    _createComponentCollector(message) {
        this.collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: this.options.timeout ?? 120_000,
        });
        this.collector.on('collect', interaction => this.buttons.get(interaction.customId)?.execute(interaction, this.client));
        this.collector.on('end', () => {
            if(!message?.components) return;

            message.edit({ components: disableComponents(message.components) });
        });
    }

    async _handleButton(interaction) {
        let page = this.pages[interaction.customId];
        if(!page) return;

        if(page.pages) {
            const pagination = new Pagination(this.client, this.interaction, page.pages, {
                ...page.pageOptions ?? this.options,
                parent: this,
            });

            //Temporarily remove collector to avoid conflicts
            this.collector.stop();
            this.collector = null;
            return await pagination.start();
        }
        else page = page.page;

        //Edit message with new page
        const navComponents = [];
        //Push all page buttons of the current page
        interaction.message.components?.forEach(row => {
            row = ActionRowBuilder.from(row);
            row.components.forEach(b => {
                if(this.buttons.has(b.data.custom_id)) navComponents.push(b);
            });
        });

        if(!this.options.showSelectedButton) {
            //Replace current page button with requested page button
            const requestedPageButton = navComponents.findIndex(b => b.data.custom_id === interaction.customId);
            navComponents.splice(requestedPageButton, 1, this.lastPage.button);
        }

        //Set last page
        this.lastPage = this.pages[interaction.customId];

        const oldComponents = page.components ?? []; //Save old components
        page.components = this.combineComponents(page, navComponents);
        // page.files ??= [];
        this.lastMessageOptions = { ...page };
        await interaction.update(page);
        page.components = oldComponents; //Reset components
    }

    async _handleNextButton(interaction) {
        const allComponents = Object.values(this.pages).map(page => page.button).filter(Boolean);

        //Find button index of first button in current page
        const buttonIndex = allComponents.findIndex(button => button.data.custom_id === interaction.message.components[0].components[0].data.custom_id);

        const newComponents = allComponents.slice(buttonIndex + 24, buttonIndex + 49);
        //Add exit button if this is a nested pagination
        if(this.parent) allComponents.unshift(this.options.exitButton);
        //Add next button if there are too many components
        if(newComponents.length > 25) newComponents.splice(24, 1, this.options.nextButton);
        //Add back button
        newComponents.splice(newComponents.length > 25 ? 23 : 24, 1, this.options.backButton);

        //Edit message with new components
        await interaction.update({ components: createActionRows(newComponents) });
    }

    async _handleBackButton(interaction) {
        const allComponents = Object.values(this.pages).map(page => page.button).filter(Boolean);

        //Find button index of first button in current page
        const buttonIndex = allComponents.findIndex(button => button.data.custom_id === interaction.message.components[0].components[0].data.custom_id);

        const newComponents = allComponents.slice(buttonIndex - 24, buttonIndex);
        //Add exit button if this is a nested pagination
        if(this.parent) allComponents.unshift(this.options.exitButton);
        //Add back button if we are not on the first page yet
        if(buttonIndex - 24 !== 0) newComponents.splice(23, 1, this.options.backButton);
        //Add next button
        newComponents.splice(24, 1, this.options.nextButton);

        //Edit message with new components
        await interaction.update({ components: createActionRows(newComponents) });
    }

    async _handleExitButton(interaction, client, forceNoExit = false) {
        if(!forceNoExit && this.parent) {
            this.collector?.stop(); //Stop child collector
            //Force prevent exit of parent so we dont exit the whole pagination but only go one step back
            return await this.parent._handleExitButton(interaction, client, true);
        }

        //Re-add component collector when going back to parent pagination
        const message = await interaction.update(this.lastMessageOptions);
        this._createComponentCollector(message);
    }

    combineComponents(page, navComponents) {
        const pageComponents = page.components?.map(component => component.components).flat() ?? [];
        const pageComponentRows = createActionRows(pageComponents);
        const maxNavComponents = (5 - pageComponentRows.length) * 5;

        //Add exit button if this is a nested pagination
        if(this.parent) navComponents.unshift(this.options.exitButton);
        //Add next button if there are too many components
        if(navComponents.length > maxNavComponents) navComponents.splice(maxNavComponents - 1, 0, this.options.nextButton);

        // Slice navComponent so that they don't override the page components
        navComponents = navComponents.slice(0, maxNavComponents);

        return [...createActionRows(navComponents), ...pageComponentRows];
    }
}
