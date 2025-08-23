import CustomBotConnection from './CustomBotConnection.js';
import ConnectionManager from './ConnectionManager.js';
import Wizard from './helpers/Wizard.js';
import keys from '../utilities/keys.js';
import {
    addTranslatedResponses,
    createActionRows,
    getComponent,
    getModal,
    getReplyOptions,
    ph,
} from '../utilities/messages.js';
import { BaseGuildTextChannel, ComponentType, MessageFlags } from 'discord.js';
import { disableComponents, generateDefaultInvite } from '../utilities/utils.js';

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

    async disconnect(connection) {
        connection.down();
        await connection.removeDataFolder();
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
    sendCustomBotCreateWizard(interaction) {
        const wizard = new Wizard(this.client, interaction, [
            keys.custom_bot.create.success.main,
            keys.custom_bot.create.success.intents,
            keys.custom_bot.create.success.details,
        ].map(key => getReplyOptions(key, ph.emojisAndColors())), {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });
        return wizard.start();
    }

    /**
     * Sends a custom bot manager to the user.
     * @param {(import('discord.js').BaseInteraction) & TranslatedResponses} interaction - The interaction to send the manager to.
     * @param {CustomBotConnection} customBotConnection - The custom bot connection to manage.
     * @return {Promise<Message>}
     */
    async sendCustomBotManager(interaction, customBotConnection) {
        const isStarted = customBotConnection.isStarted();

        const placeholders = {
            port: customBotConnection.port,
            invite: generateDefaultInvite(customBotConnection.id),
            status: isStarted ? keys.custom_bot.custom_bot_manager.status.started : keys.custom_bot.custom_bot_manager.status.stopped,
        };

        const mainMessage = getReplyOptions(keys.custom_bot.custom_bot_manager.success.main, ph.emojisAndColors(), placeholders);
        const buttons = [getComponent(keys.custom_bot.custom_bot_manager.buttons.delete)];
        if(isStarted) buttons.unshift(getComponent(keys.custom_bot.custom_bot_manager.buttons.stop));
        else buttons.unshift(getComponent(keys.custom_bot.custom_bot_manager.buttons.start));
        mainMessage.components[0].components.unshift(...buttons);

        const message = await interaction.replyOptions(mainMessage);

        const collector = message.createMessageComponentCollector({
            time: Wizard.DEFAULT_TIMEOUT,
            componentType: ComponentType.Button,
        });
        collector.on('collect', async btnInteraction => {
            btnInteraction = addTranslatedResponses(btnInteraction);

            switch(btnInteraction.customId) {
                case 'custom_bot_start':
                    await btnInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                    try {
                        await customBotConnection.start();

                        buttons.splice(0, 1, getComponent(keys.custom_bot.custom_bot_manager.buttons.stop));
                        mainMessage.components = createActionRows(buttons);
                        mainMessage.embeds[0].fields[0].value = keys.custom_bot.custom_bot_manager.status.started;
                        await interaction.replyOptions(mainMessage);

                        await btnInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.start);
                    }
                    catch(err) {
                        await btnInteraction.replyTl(keys.custom_bot.errors.start_failed);
                    }
                    break;
                case 'custom_bot_stop':
                    await btnInteraction.deferReply({ flags: MessageFlags.Ephemeral });

                    customBotConnection.stop();

                    buttons.splice(0, 1, getComponent(keys.custom_bot.custom_bot_manager.buttons.start));
                    mainMessage.components = createActionRows(buttons);
                    mainMessage.embeds[0].data.fields[0].value = keys.custom_bot.custom_bot_manager.status.stopped;
                    await interaction.replyOptions(mainMessage);

                    await btnInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.stop);
                    break;
                case 'custom_bot_delete':
                    // modals cant be deferred
                    await btnInteraction.showModal(getModal(keys.custom_bot.custom_bot_manager.confirm_delete));
                    break;
            }
        });
        collector.on('end', () => interaction.replyOptions({ components: disableComponents(mainMessage.components) }));
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