import Discord from 'discord.js';
import ServerConnectionManager from './ServerConnectionManager.js';
import UserConnectionManager from './UserConnectionManager.js';
import ServerSettingsConnectionManager from './ServerSettingsConnectionManager.js';
import UserSettingsConnectionManager from './UserSettingsConnectionManager.js';
import fs from 'fs-extra';
import { addPh } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import path from 'path';
import Command from './Command.js';
import Button from './Button.js';
import Event from './Event.js';
import MCLinkerAPI from './MCLinkerAPI.js';
import * as utils from '../utilities/utils.js';
import { convert } from '../scripts/convert.js';
import mongoose, { Schema } from 'mongoose';
import Schemas from '../resources/schemas.js';
import logger from '../utilities/logger.js';

export default class MCLinker extends Discord.Client {

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
     * A collection of all commands in this bot.
     * @type {Discord.Collection<string, Command>}
     */
    commands = new Discord.Collection();

    /**
     * A collection of all buttons in this bot.
     * @type {Discord.Collection<string, Button>}
     */
    buttons = new Discord.Collection();

    /**
     * A collection of all events in this bot.
     * @type {Collection}
     */
    events = new Discord.Collection();

    /**
     * Creates a new MCLinker client instance.
     * @param {string} commandPath - The path to the commands folder.
     * @param {string} buttonPath - The path to the buttons folder.
     * @param {string} eventPath - The path to the events folder.
     * @param {Discord.ClientOptions} options - The options to pass to the Discord.js client.
     * @returns {MCLinker} - The new MCLinker client instance.
     */
    constructor(commandPath = './commands', buttonPath = './buttons', eventPath = './events', options = {
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
        // Disable @everyone and @here mentions
        allowedMentions: { parse: ['users', 'roles'] },
    }) {
        super(options);

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
         * A collection of all commands in this bot.
         * @type {Collection<string, Command>}
         */
        this.commands = new Discord.Collection();

        /**
         * A collection of all buttons in this bot.
         * @type {import('discord.js').Collection<string, Button>}
         */
        this.buttons = new Discord.Collection();

        /**
         * A collection of all events in this bot.
         * @type {import('discord.js').Collection<string, Event>}
         */
        this.events = new Discord.Collection();

        /**
         * The path to the commands folder.
         * @type {string}
         */
        this.commandPath = commandPath;

        /**
         * The path to the buttons folder.
         * @type {string}
         */
        this.buttonPath = buttonPath;

        /**
         * The path to the events folder.
         * @type {string}
         */
        this.eventPath = eventPath;

        /**
         * Utility functions for the bot to use in cross-shard communication.
         * @type {typeof utils}
         */
        this.utils = { ...utils };

        /**
         * The language keys for the bot to use in cross-shard communication.
         * @type {typeof keys}
         */
        this.keys = { ...keys };

        /**
         * The API instance of the bot.
         * @type {MCLinkerAPI}
         */
        this.api = new MCLinkerAPI(this);
    }

    async _loadCommands() {
        const loadCommand = async (file, category = null) => {
            // noinspection LocalVariableNamingConventionJS
            const { default: CommandFile } = category ?
                await import(`file://${path.resolve(`${this.commandPath}/${category}/${file}`)}`) :
                await import(`file://${path.resolve(`${this.commandPath}/${file}`)}`);

            if(CommandFile?.prototype instanceof Command) {
                const command = new CommandFile();

                this.commands.set(command.name, command);
                logger.info(addPh(
                    category ? keys.main.success.command_load_category.console : keys.main.success.command_load.console,
                    { command: command.name, category: category, shard: this.shard.ids[0] },
                ));
            }
        };

        const commands = await fs.readdir(this.commandPath);

        const commandCategories = commands.filter(command => !command.endsWith('.js'));
        const commandFiles = commands.filter(command => command.endsWith('.js'));
        for(const file of commandFiles) await loadCommand.call(this, file);

        for(const category of commandCategories) {
            const commandFiles = (await fs.readdir(`${this.commandPath}/${category}`))
                .filter(file => file.endsWith('.js'));

            for(const file of commandFiles) await loadCommand(file, category);
        }
    }

    async _loadButtons() {
        const buttonFiles = (await fs.readdir(this.buttonPath))
            .filter(file => file.endsWith('.js'));

        for(const file of buttonFiles) {
            // noinspection LocalVariableNamingConventionJS
            const { default: ButtonFile } = await import(`file://${path.resolve(`${this.buttonPath}/${file}`)}`);
            if(ButtonFile?.prototype instanceof Button) {
                const button = new ButtonFile();

                this.buttons.set(button.id, button);
                logger.info(addPh(keys.main.success.button_load.console, {
                    button: button.id,
                    shard: this.shard.ids[0],
                }));
            }
        }
    }

    async _loadEvents() {
        const eventFiles = (await fs.readdir(this.eventPath))
            .filter(file => file.endsWith('.js'));

        for(const file of eventFiles) {
            // noinspection LocalVariableNamingConventionJS
            const { default: EventFile } = await import(`file://${path.resolve(`${this.eventPath}/${file}`)}`);
            if(EventFile?.prototype instanceof Event) {
                const event = new EventFile();
                if(event.shard !== -1 && !this.shard.ids.includes(event.shard)) continue; // Skip events not for this shard

                this.events.set(event.name, event);
                if(event.once) this.once(event.name, (...args) => event.execute(this, ...args));
                else this.on(event.name, (...args) => event.execute(this, ...args));
                logger.info(addPh(keys.main.success.event_load.console, {
                    event: event.name,
                    shard: this.shard.ids[0],
                }));
            }
        }
    }

    /**
     * Loads the mongodb database and all commands, user and server connections into the cache.
     * @returns {Promise<void>} - A promise that resolves when all commands, user and server connections are loaded.
     */
    async loadEverything() {
        await this.loadMongoose();
        logger.info(`[${this.shard.ids[0]}] Loaded all mongo models: ${Object.keys(this.mongo.models).join(', ')}`);

        if(process.env.CONVERT === 'true' && this.shard.ids[0] === 0) {
            await convert(this, this.mongo);
            logger.info('Converted database.');
        }

        await this.serverConnections._load();
        logger.info(`[${this.shard.ids[0]}] Loaded all server connections.`);
        await this.userConnections._load();
        logger.info(`[${this.shard.ids[0]}] Loaded all user connections.`);
        await this.serverSettingsConnections._load();
        logger.info(`[${this.shard.ids[0]}] Loaded all server-settings connections.`);
        await this.userSettingsConnections._load();
        logger.info(`[${this.shard.ids[0]}] Loaded all user-settings connections.`);

        await this._loadCommands();
        logger.info(`[${this.shard.ids[0]}] Loaded all commands.`);
        await this._loadButtons();
        logger.info(`[${this.shard.ids[0]}] Loaded all buttons.`);
        await this._loadEvents();
        logger.info(`[${this.shard.ids[0]}] Loaded all events.`);
    }

    async loadMongoose() {
        /**
         * The mongoose database client.
         * @type {Mongoose}
         */
        this.mongo = await mongoose.connect(process.env.DATABASE_URL);

        const serverConnectionSchema = new Schema(Schemas.ServerConnection);
        const serverSettingsConnectionSchema = new Schema(Schemas.ServerSettingsConnection);
        const userSettingsConnectionSchema = new Schema(Schemas.UserSettingsConnection);
        const userConnectionSchema = new Schema(Schemas.UserConnection);

        this.mongo.model('ServerConnection', serverConnectionSchema);
        this.mongo.model('UserConnection', userConnectionSchema);
        this.mongo.model('ServerSettingsConnection', serverSettingsConnectionSchema);
        this.mongo.model('UserSettingsConnection', userSettingsConnectionSchema);
    }
}
