import CustomBotConnection from './CustomBotConnection.js';
import ConnectionManager from './ConnectionManager.js';
import Wizard from './helpers/Wizard.js';
import keys from '../utilities/keys.js';
import { addTranslatedResponses, getComponent, getModal, getReplyOptions, ph } from '../utilities/messages.js';
import Discord, {
    ActionRowBuilder,
    AttachmentBuilder,
    BaseGuildTextChannel,
    ComponentType,
    InteractionCollector,
    InteractionType,
    MessageFlags,
} from 'discord.js';
import { disableComponents, generateDefaultInvite } from '../utilities/utils.js';
import logger from '../utilities/logger.js';

export default class CustomBotConnectionManager extends ConnectionManager {

    /**
     * The port to start searching for available ports from.
     * @type {number}
     */
    static STARTING_PORT = 30_000;

    /**
     * @type {import('discord.js').Collection<string, CustomBotConnection>}
     */
    cache;

    /**
     * Creates a new ServerConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {ServerConnectionManager} - A new ServerConnectionManager instance.
     */
    constructor(client, collectionName = 'CustomBotConnection') {
        super(client, CustomBotConnection, collectionName);

        /**
         * The connection cache of this manager.
         * @type {import('discord.js').Collection<string, ServerConnection>}
         */
        this.cache = super.cache;
    }

    async disconnect(connectionResolvable) {
        /** @type {CustomBotConnection} */
        const connection = this.resolve(connectionResolvable);

        connection.preDeleteCleanup();

        await connection.down();
        await connection.removeData();
        return super.disconnect(connection);
    }

    /**
     * Checks if a user has a custom bot connection.
     * @param {string} userId - The ID of the user to check.
     * @return {boolean}
     */
    hasCustomBot(userId) {
        return this.cache.some(connection => connection.ownerId === userId);
    }

    /**
     * Gets the custom bot connection for a user.
     * @param {string} userId - The ID of the user to get the custom bot connection for.
     * @return {?CustomBotConnection} - The custom bot connection if it exists,
     */
    getCustomBot(userId) {
        return this.cache.find(connection => connection.ownerId === userId);
    }

    /**
     * Sends a custom bot creation wizard to the user.
     * This wizard will guide the user through the process of creating a custom bot.
     * @param {(Message|import('discord.js').BaseInteraction) & TranslatedResponses|BaseGuildTextChannel} interaction - The interaction or channel to send the wizard to.
     * @return {Promise<Message>}
     */
    async sendCustomBotCreateWizard(interaction) {
        const detailsOptions = getReplyOptions(keys.custom_bot.create.success.details);
        detailsOptions.files = [
            new AttachmentBuilder('./resources/images/custom_bot/reset_token.png', { name: 'reset_token.png' }),
        ];

        const disablePublicOptions = getReplyOptions(keys.custom_bot.create.success.disable_public_bot);
        disablePublicOptions.files = [
            new AttachmentBuilder('./resources/images/custom_bot/disable_public_bot.gif', { name: 'disable_public_bot.gif' }),
        ];

        const wizardPages = [
            getReplyOptions(keys.custom_bot.create.success.main),
            disablePublicOptions,
            detailsOptions,
        ];

        const wizard = new Wizard(this.client, interaction, wizardPages, {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });

        const message = await wizard.start();

        const collector = message.createMessageComponentCollector({
            time: 60_000 * 14,
            componentType: Discord.ComponentType.Button,
            filter: btnInteraction => btnInteraction.customId === 'customize_enter_details',
        });
        collector.on('collect', btnInteraction =>
            btnInteraction.showModal(getModal(keys.custom_bot.create.token_modal)));

        return message;
    }

    /**
     * Sends a custom bot manager to the user.
     * @param {(import('discord.js').BaseInteraction) & TranslatedResponses} interaction - The interaction to send the manager to.
     * @param {CustomBotConnection} customBotConnection - The custom bot connection to manage.
     * @return {Promise<Message>}
     */
    async sendCustomBotManager(interaction, customBotConnection) {
        const isStarted = await customBotConnection.isStarted();

        const placeholders = {
            port: customBotConnection.port,
            invite: generateDefaultInvite(customBotConnection.id),
            status: isStarted ? keys.custom_bot.custom_bot_manager.status.started : keys.custom_bot.custom_bot_manager.status.stopped,
        };

        const mainMessage = getReplyOptions(keys.custom_bot.custom_bot_manager.success.main, placeholders);
        const buttonsRow1 = [keys.custom_bot.custom_bot_manager.buttons.delete]
            .map(c => getComponent(c, placeholders));
        const buttonsRow2 = [
            keys.custom_bot.custom_bot_manager.buttons.invite,
            keys.custom_bot.custom_bot_manager.buttons.change_presence,
        ].map(c => getComponent(c, placeholders));
        if(isStarted) buttonsRow1.unshift(getComponent(keys.custom_bot.custom_bot_manager.buttons.stop));
        else buttonsRow1.unshift(getComponent(keys.custom_bot.custom_bot_manager.buttons.start));
        mainMessage.components = [buttonsRow1, buttonsRow2].map(b => new ActionRowBuilder().addComponents(b));

        const message = await interaction.replyOptions(mainMessage);

        const buttonCollector = message.createMessageComponentCollector({
            time: 60_000 * 14,
            componentType: ComponentType.Button,
        });
        buttonCollector.on('collect', async btnInteraction => {
            btnInteraction = addTranslatedResponses(btnInteraction);

            switch(btnInteraction.customId) {
                case 'custom_bot_start':
                    await btnInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                    try {
                        await customBotConnection.start();

                        buttonsRow1.splice(0, 1, getComponent(keys.custom_bot.custom_bot_manager.buttons.stop));
                        mainMessage.components[0].setComponents(buttonsRow1);
                        mainMessage.embeds[0].data.fields[0].value = keys.custom_bot.custom_bot_manager.status.started;
                        await interaction.replyOptions(mainMessage);

                        await btnInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.start);
                    }
                    catch(err) {
                        logger.error(err, 'Failed to start custom bot connection');
                        await btnInteraction.replyTl(keys.custom_bot.errors.start_failed);
                    }
                    break;
                case 'custom_bot_stop':
                    await btnInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                    await customBotConnection.stop();

                    buttonsRow1.splice(0, 1, getComponent(keys.custom_bot.custom_bot_manager.buttons.start));
                    mainMessage.components[0].setComponents(buttonsRow1);
                    mainMessage.embeds[0].data.fields[0].value = keys.custom_bot.custom_bot_manager.status.stopped;
                    await interaction.replyOptions(mainMessage);

                    await btnInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.stop);
                    break;
                case 'custom_bot_delete':
                    // modals cant be deferred
                    await btnInteraction.showModal(getModal(keys.custom_bot.custom_bot_manager.confirm_delete_modal));
                    break;
                case 'custom_bot_change_presence':
                    await btnInteraction.showModal(getModal(keys.custom_bot.custom_bot_manager.change_presence_modal));
                    break;
            }
        });
        buttonCollector.on('end', () => interaction.replyOptions({ components: disableComponents(mainMessage.components) }));
        const modalCollector = new InteractionCollector(this.client, {
            time: 60_000 * 14,
            interactionType: InteractionType.ModalSubmit,
            message,
        });
        modalCollector.on('collect', async modalInteraction => {
            modalInteraction = addTranslatedResponses(modalInteraction);

            if(modalInteraction.customId === 'customize_confirm_delete') {
                await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                if(modalInteraction.fields.getTextInputValue('confirm_delete') !== 'delete')
                    return await modalInteraction.replyTl(keys.custom_bot.custom_bot_manager.warnings.invalid_confirmation);

                const reason = modalInteraction.fields.getTextInputValue('confirm_delete_reason') || 'No reason provided';
                logger.info(`Custom bot connection for ${modalInteraction.user.id} deleted with reason: "${reason}"`);

                const customBotConnection = this.client.customBots.getCustomBot(modalInteraction.user.id);
                await this.client.customBots.disconnect(customBotConnection);

                const newMainMessageOptions = getReplyOptions(keys.custom_bot.custom_bot_manager.success.main, {
                    port: '-',
                    invite: '', // needed for component builder to build
                    status: keys.custom_bot.custom_bot_manager.status.deleted,
                });
                newMainMessageOptions.components = [];
                await modalInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.delete, await ph.commandName('customize', this.client, true));
                await interaction.replyOptions(newMainMessageOptions);
            }
            else if(modalInteraction.customId === 'customize_set_presence') {
                await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                /** @type {import('discord.js').PresenceStatus} */
                const status = modalInteraction.fields.getStringSelectValues('presence_status')[0];
                const activityName = modalInteraction.fields.getTextInputValue('activity_name');
                /** @type {import('discord.js').ActivityType} */
                const activityType = modalInteraction.fields.getStringSelectValues('activity_type')[0];
                const activityState = modalInteraction.fields.getTextInputValue('activity_state');

                /** @type {import('discord.js').PresenceData} */
                const newPresence = {
                    status,
                    activities: [],
                };

                if(activityName) {
                    newPresence.activities.push({
                        name: activityName,
                        state: activityState,
                        type: Discord.ActivityType[activityType],
                    });
                }

                const success = await customBotConnection.setPresence(newPresence);
                if(!success)
                    return await modalInteraction.replyTl(keys.custom_bot.custom_bot_manager.errors.change_presence_failed, { error: success.message });
                await modalInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.change_presence);
            }
        });
    }

    /**
     * Updates all custom bot connections.
     * @return {Promise<void[]>} - A promise that resolves when all custom bot connections have been updated.
     */
    updateAllBots() {
        return Promise.all(this.cache.map(connection => connection.update()));
    }

    /**
     * Gets the port range for custom bots.
     * @return {number[]}
     */
    getPortRange() {
        const startPort = CustomBotConnectionManager.STARTING_PORT;
        const endPort = this.cache.reduce((max, connection) => Math.max(max, connection.port), startPort);
        return [startPort, endPort];
    }

    /**
     * Finds the next available port for a new custom bot connection.
     * @return {number} - The next available port.
     */
    getNewAvailablePort() {
        const usedPorts = this.cache.map(connection => connection.port);
        let port = CustomBotConnectionManager.STARTING_PORT;
        while(usedPorts.includes(port)) port++;
        return port;
    }
}