import CustomBotConnection from './CustomBotConnection.js';
import ConnectionManager from './ConnectionManager.js';
import Wizard from './helpers/Wizard.js';
import keys from '../utilities/keys.js';
import { getModal, getReplyOptions, ph } from '../utilities/messages.js';
import { BaseGuildTextChannel, ComponentType, MessageFlags } from 'discord.js';
import { generateDefaultInvite } from '../utilities/utils.js';
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

    async disconnect(connection) {
        //Shutdown the docker container
        logger.info(execSync(`docker compose down`, { cwd: `./Custom-MC-Linker/${connection.ownerId}` }).toString());

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
            keys.commands.customize.success.start,
            keys.commands.customize.success.intents,
            keys.commands.customize.success.details,
        ].map(key => getReplyOptions(key, ph.emojisAndColors())), {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });
        return wizard.start();
    }

    /**
     * Sends a custom bot manager to the user.
     * @param {(Message|import('discord.js').BaseInteraction) & TranslatedResponses|BaseGuildTextChannel} interaction - The interaction or channel to send the manager to.
     * @param {CustomBotConnection} customBotConnection - The custom bot connection to manage.
     * @return {Promise<Message>}
     */
    async sendCustomBotManager(interaction, customBotConnection) {
        const placeholders = {
            port: customBotConnection.port,
            invite: generateDefaultInvite(customBotConnection.id),
        };

        let message;
        if(interaction instanceof BaseGuildTextChannel)
            message = await interaction.send(getReplyOptions(keys.entitlements.success.custom_bot_manager, ph.emojisAndColors(), placeholders));
        else message = await interaction.replyTl(keys.entitlements.custom_bot_manager.success.main, ph.emojisAndColors(), placeholders);

        const collector = message.createMessageComponentCollector({
            time: Wizard.DEFAULT_TIMEOUT,
            componentType: ComponentType.Button,
        });
        collector.on('collect', async interaction => {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            switch(interaction.customId) {
                case 'custom_bot_start':
                    try {
                        await customBotConnection.start();
                        await interaction.reply(getReplyOptions(keys.entitlements.custom_bot_manager.success.start, ph.emojisAndColors()));
                    }
                    catch(err) {
                        await interaction.reply(getReplyOptions(keys.commands.customize.errors.startup_failed, ph.emojisAndColors()));
                    }
                    break;
                case 'custom_bot_stop':
                    await customBotConnection.stop();
                    await interaction.reply(getReplyOptions(keys.entitlements.custom_bot_manager.success.stop, ph.emojisAndColors()));
                    break;
                case 'custom_bot_delete':
                    await interaction.showModal(getModal(keys.entitlements.custom_bot_manager.confirm_delete));
                    break;
            }
        });
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