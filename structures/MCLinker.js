import Discord, { Options } from 'discord.js';
import ServerConnectionManager from './connections/managers/ServerConnectionManager.js';
import UserConnectionManager from './connections/managers/UserConnectionManager.js';
import ServerSettingsConnectionManager from './connections/managers/ServerSettingsConnectionManager.js';
import UserSettingsConnectionManager from './connections/managers/UserSettingsConnectionManager.js';
import CustomBotConnectionManager from './connections/managers/CustomBotConnectionManager.js';
import fs from 'fs-extra';
import { ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import path from 'path';
import Command from './Command.js';
import Component from './Component.js';
import Event from './Event.js';
import MCLinkerAPI from '../api/MCLinkerAPI.js';
import AnalyticsCollector, { trackError } from './analytics/AnalyticsCollector.js';
import * as utils from '../utilities/utils.js';
import mongoose, { Schema } from 'mongoose';
import Schemas from '../resources/schemas.js';
import rootLogger from '../utilities/logger/Logger.js';
import features from '../utilities/logger/features.js';
import { convert } from '../scripts/convert.js';

const logger = rootLogger.child({ feature: features.core.startup });

export default class MCLinker extends Discord.Client {

    /**
     * @typedef {Object} MCLinkerConfig
     * @property {string} prefix - The prefix for the bot.
     * @property {string} commandsPath - The path to the commands folder.
     * @property {string} componentsPath - The path to the components folder.
     * @property {string} eventsPath - The path to the events folder.
     * @property {string} restRoutesPath - The path to the API routes folder.
     * @property {string} wsEventsPath - The path to the API websocket events folder.
     * @property {import('discord.js').PresenceData} presence - The presence data for the bot.
     * @property {string} pluginVersion - The latest version of the Minecraft plugin.
     * @property {string} supportServerInvite - The invite link to the support server.
     * @property {{string, string}} emojis - A map of the bot's emoji names to their codes.
     * @property {{string, string}} colors - A map of the bot's color names to their hex codes.
     * @property {DebugFilter[]} [initialDebugFilters] - Debug filter to apply at startup.
     * @property {{flushIntervalMs: number, maxErrorBufferSize: number, snapshotIntervalMs: number}} analytics - Analytics configuration.
     */

    /**
     * The user-connection manager for the bot.
     * @type {UserConnectionManager}
     */
    userConnections;

    /**
     * The server-connection manager for the bot.
     * @type {ServerConnectionManager}
     */
    serverConnections;

    /**
     * The settings-connection manager for the bot.
     * @type {ServerSettingsConnectionManager}
     */
    serverSettingsConnections;

    /**
     * The user-settings connection manager for the bot.
     * @type {UserSettingsConnectionManager}
     */
    userSettingsConnections;

    /**
     * The custom-bot connection manager for the bot.
     * @type {CustomBotConnectionManager}
     */
    customBots;

    /**
     * A collection of all commands in this bot.
     * @type {Discord.Collection<string, Command>}
     */
    commands = new Discord.Collection();

    /**
     * A collection of all components in this bot.
     * @type {Discord.Collection<string, Component>}
     */
    components = new Discord.Collection();

    /**
     * A collection of all events in this bot.
     * @type {Collection}
     */
    events = new Discord.Collection();

    /**
     * Creates a new MCLinker client instance.
     * @param {MCLinkerConfig} config - The configuration for the bot.
     * @returns {MCLinker} - The new MCLinker client instance.
     */
    constructor(config) {
        super({
            intents: [
                Discord.GatewayIntentBits.GuildMessages,
                Discord.GatewayIntentBits.GuildMembers,
                Discord.GatewayIntentBits.Guilds,
                Discord.GatewayIntentBits.DirectMessages,
                Discord.GatewayIntentBits.MessageContent,
            ],
            partials: [
                Discord.Partials.Channel,
                Discord.Partials.GuildMember,
            ],
            makeCache: Options.cacheWithLimits({
                // Don’t cache any messages
                MessageManager: 0,
                // Limit number of members cached per guild
                GuildMemberManager: 100,
                UserManager: 100,
                ReactionManager: 0,
                PresenceManager: 0,
            }),
            // Disable @everyone and @here mentions
            allowedMentions: { parse: ['users', 'roles'] },
            presence: config.presence,
            rest: {
                // Reject rate limits instead of silently queuing, so callers can handle them
                // (e.g. retry with a different webhook, schedule a deferred re-sync).
                rejectOnRateLimit: data => {
                    // Channel name changes (stat channels)
                    if(data.method === 'PATCH' && data.route === '/channels/:id') return true;
                    // Webhook sends (POST) and message edits (PATCH) for chat channels
                    if(data.method === 'POST' && data.route === '/webhooks/:id/:token') return true;
                    if(data.method === 'PATCH' && data.route === '/webhooks/:id/:token/messages/:id') return true;
                    // Webhook management: fetchWebhooks, createWebhook, fetchWebhook, deleteWebhook
                    if(data.route === '/channels/:id/webhooks') return true;
                    if(data.route === '/webhooks/:id') return true;
                    return false;
                },
            },
        });

        logger.setShardId(this.shard.ids[0]);

        /**
         * The configuration of the bot.
         * @type {MCLinkerConfig}
         */
        this.config = config;

        /**
         * The server-connection manager for the bot.
         * @type {ServerConnectionManager}
         */
        this.serverConnections = new ServerConnectionManager(this);

        /**
         * The user-connection manager for the bot.
         * @type {UserConnectionManager}
         */
        this.userConnections = new UserConnectionManager(this);

        /**
         * The server-settings connection-manager for the bot.
         * @type {ServerSettingsConnectionManager}
         */
        this.serverSettingsConnections = new ServerSettingsConnectionManager(this);

        /**
         * The user-settings connection-manager for the bot.
         * @type {UserSettingsConnectionManager}
         */
        this.userSettingsConnections = new UserSettingsConnectionManager(this);

        /**
         * The custom-bot connection manager for the bot.
         * @type {CustomBotConnectionManager}
         */
        this.customBots = new CustomBotConnectionManager(this);

        /**
         * A collection of all commands in this bot.
         * @type {Collection<string, Command>}
         */
        this.commands = new Discord.Collection();

        /**
         * A collection of all buttons in this bot.
         * @type {import('discord.js').Collection<string, Component>}
         */
        this.components = new Discord.Collection();

        /**
         * A collection of all events in this bot.
         * @type {import('discord.js').Collection<string, Event>}
         */
        this.events = new Discord.Collection();

        /**
         * Utility functions for the bot to use in cross-shard communication.
         * @type {typeof utils}
         */
        this.utils = utils;

        /**
         * The language keys for the bot to use in cross-shard communication.
         * @type {typeof keys}
         */
        this.keys = keys;

        /**
         * The log feature names for the bot to use in cross-shard communication.
         * @type {typeof features}
         */
        this.features = features;

        /**
         * The logger for the bot to use in cross-shard communication.
         * @type {import('pino').Logger}
         */
        this.logger = rootLogger;

        /**
         * The API instance of the bot.
         * @type {MCLinkerAPI}
         */
        this.api = new MCLinkerAPI(this);

        /**
         * The per-shard analytics collector.
         * @type {AnalyticsCollector}
         */
        this.analytics = new AnalyticsCollector(this);

        /**
         * BroadcastEval with MCLinker typing.
         * @type {BroadcastEvalMC}
         */
        this.broadcastEval = this.shard.broadcastEval.bind(this.shard);
    }

    /**
     * Loads the configuration from the config.json file.
     * @param {string} [path=./config.json] - The path to the config file.
     * @return {Promise<MCLinkerConfig>}
     */
    static async loadConfig(path = `./config.json`) {
        const config = await fs.readJson(path);
        // Parse ActivityType
        for(const activity of config.presence.activities)
            activity.type = Discord.ActivityType[activity.type];
        return config;
    }

    /**
     * Writes the configuration to the config.json file.
     * @param {MCLinkerConfig} config - The configuration to write.
     * @param {string} [path=./config.json] - The path to the config file.
     * @return {Promise<void>}
     */
    static async writeConfig(config, path = `./config.json`) {
        // Convert ActivityType back to string
        const configCopy = JSON.parse(JSON.stringify(config));
        for(const activity of configCopy.presence.activities)
            activity.type = Object.keys(Discord.ActivityType).find(k => Discord.ActivityType[k] === activity.type) ?? activity.type;
        await fs.outputJson(path, configCopy, { spaces: 4 });
    }

    isCustomBot() {
        return process.env.CUSTOM_BOT === 'true';
    }

    async _loadCommands() {
        const loadCommand = async (file, category = null) => {
            // noinspection LocalVariableNamingConventionJS
            const { default: CommandFile } = category ?
                await import(`file://${path.resolve(`${this.config.commandsPath}/${category}/${file}`)}`) :
                await import(`file://${path.resolve(`${this.config.commandsPath}/${file}`)}`);

            if(CommandFile?.prototype instanceof Command) {
                const command = new CommandFile();

                this.commands.set(command.name, command);
                logger.debug(`Successfully loaded command: ${category ? `${category}/` : ''}${command.name}`);
            }
        };

        await fs.ensureDir(this.config.commandsPath);
        const commands = await fs.readdir(this.config.commandsPath);

        const commandCategories = commands.filter(command => !command.endsWith('.js'));
        const commandFiles = commands.filter(command => command.endsWith('.js'));
        for(const file of commandFiles) await loadCommand.call(this, file);

        for(const category of commandCategories) {
            const commandFiles = (await fs.readdir(`${this.config.commandsPath}/${category}`))
                .filter(file => file.endsWith('.js'));

            for(const file of commandFiles) await loadCommand(file, category);
        }
    }

    async _loadButtons() {
        await fs.ensureDir(this.config.componentsPath);
        const buttonFiles = (await fs.readdir(this.config.componentsPath))
            .filter(file => file.endsWith('.js'));

        for(const file of buttonFiles) {
            // noinspection LocalVariableNamingConventionJS
            const { default: ComponentFile } = await import(`file://${path.resolve(`${this.config.componentsPath}/${file}`)}`);
            if(ComponentFile?.prototype instanceof Component) {
                const component = new ComponentFile();

                this.components.set(component.id, component);
                logger.debug(`Successfully loaded component of type ${component.type}: ${component.id}`);
            }
        }
    }

    async _loadEvents() {
        await fs.ensureDir(this.config.eventsPath);
        const eventFiles = (await fs.readdir(this.config.eventsPath))
            .filter(file => file.endsWith('.js'));

        for(const file of eventFiles) {
            // noinspection LocalVariableNamingConventionJS
            const { default: EventFile } = await import(`file://${path.resolve(`${this.config.eventsPath}/${file}`)}`);
            if(EventFile?.prototype instanceof Event) {
                const event = new EventFile();
                if(event.shard !== -1 && !this.shard.ids.includes(event.shard)) continue; // Skip events not for this shard

                this.events.set(event.name, event);
                if(event.once) this.once(event.name, (...args) => event.execute(this, ...args));
                else this.on(event.name, (...args) => event.execute(this, ...args));
                logger.debug(`Successfully loaded event: ${event.name}`);
            }
        }
    }

    /**
     * Loads the mongodb database and all commands, user and server connections into the cache.
     * @returns {Promise<void>} - A promise that resolves when all commands, user and server connections are loaded.
     */
    async loadEverything() {
        ph.initClient(this);
        logger.debug(`Initialized placeholders.`);

        await this.loadMongoose();
        logger.debug(`Loaded all mongo models: ${Object.keys(this.mongo.models).join(', ')}`);

        if(process.env.CONVERT === 'true' && this.shard.ids[0] === 0) {
            await convert(this, this.mongo);
            logger.info('Converted database.');
        }

        await this.serverConnections._load();
        logger.info(`Loaded all server connections.`);
        await this.userConnections._load();
        logger.info(`Loaded all user connections.`);
        await this.serverSettingsConnections._load();
        logger.info(`Loaded all server-settings connections.`);
        await this.userSettingsConnections._load();
        logger.info(`Loaded all user-settings connections.`);
        await this.customBots._load();
        logger.info(`Loaded all custom bots.`);

        await this._loadCommands();
        logger.info(`Loaded all commands.`);
        await this._loadButtons();
        logger.info(`Loaded all buttons.`);
        await this._loadEvents();
        logger.info(`Loaded all events.`);

        await this.api.loadHandlers();
        logger.info(`Loaded all API handlers.`);
    }

    async loadMongoose() {
        /**
         * The mongoose database client.
         * @type {import('mongoose').Mongoose}
         */
        this.mongo = await mongoose.connect(`${process.env.DATABASE_URL}/${process.env.DATABASE_NAME}`);

        for(const [name, schema] of Object.entries(Schemas))
            this.mongo.model(name, new Schema(schema));

        // Ensure analytics indexes exist (no-ops if already created)
        this.mongo.models.AnalyticsSnapshot?.collection.createIndex({ timestamp: -1 }).catch(err => trackError('unhandled', 'createIndex', null, null, err, { index: 'AnalyticsSnapshot.timestamp' }, logger));
        this.mongo.models.AnalyticsError?.collection.createIndex({ timestamp: -1 }).catch(err => trackError('unhandled', 'createIndex', null, null, err, { index: 'AnalyticsError.timestamp' }, logger));
    }
}
