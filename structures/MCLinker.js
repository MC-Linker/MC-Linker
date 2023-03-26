import Discord from 'discord.js';
import ServerConnectionManager from './ServerConnectionManager.js';
import UserConnectionManager from './UserConnectionManager.js';
import ServerSettingsConnectionManager from './ServerSettingsConnectionManager.js';
import UserSettingsConnectionManager from './UserSettingsConnectionManager.js';
import fs from 'fs-extra';
import { addPh } from '../api/messages.js';
import keys from '../api/keys.js';
import path from 'path';
import Command from './Command.js';
import Button from './Button.js';
import BotAPI from '../api/BotAPI.js';
import * as utils from '../api/utils.js';

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
     * Creates a new MCLinker client instance.
     * @param {string} commandPath - The path to the commands folder.
     * @param {string} buttonPath - The path to the buttons folder.
     * @param {Discord.ClientOptions} options - The options to pass to the Discord.js client.
     * @returns {MCLinker} - The new MCLinker client instance.
     */
    constructor(commandPath = './commands', buttonPath = './buttons', options = {
        intents: [
            Discord.GatewayIntentBits.GuildMessages,
            Discord.GatewayIntentBits.Guilds,
            Discord.GatewayIntentBits.DirectMessages,
            Discord.GatewayIntentBits.MessageContent,
        ],
        // Disable @everyone and @here mentions
        allowedMentions: { parse: [Discord.AllowedMentionsTypes.Role, Discord.AllowedMentionsTypes.User] },
    }) {
        super(options);

        /**
         * The API instance of the bot.
         * @type {BotAPI}
         */
        this.api = new BotAPI(this);

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
         * Utility functions for the bot to use in cross-shard communication.
         * @type {typeof utils}
         */
        this.utils = { ...utils };
    }

    async _loadCommands() {
        const commands = await fs.readdir(this.commandPath);

        const commandCategories = commands.filter(command => !command.endsWith('.js'));
        const commandFiles = commands.filter(command => command.endsWith('.js'));
        commandFiles.forEach(file => loadCommand.call(this, file));

        for(const category of commandCategories) {
            const commandFiles = (await fs.readdir(`${this.commandPath}/${category}`))
                .filter(file => file.endsWith('.js'));

            for(const file of commandFiles) await loadCommand.call(this, file, category);
        }

        async function loadCommand(file, category = null) {
            // noinspection LocalVariableNamingConventionJS
            const { default: CommandFile } = category ?
                await import(`file://${path.resolve(`${this.commandPath}/${category}/${file}`)}`) :
                await import(`file://${path.resolve(`${this.commandPath}/${file}`)}`);

            if(CommandFile?.prototype instanceof Command) {
                const command = new CommandFile();

                // noinspection JSPotentiallyInvalidUsageOfClassThis
                this.commands.set(command.name, command);
                console.log(addPh(
                    category ? keys.main.success.command_load_category.console : keys.main.success.command_load.console,
                    { command: command.name, category: category, shard: this.shard.ids[0] },
                ));
            }
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
                console.log(addPh(keys.main.success.button_load.console, {
                    button: button.id,
                    shard: this.shard.ids[0],
                }));
            }
        }
    }

    /**
     * Loads all commands, user and server connections into the cache
     * @returns {Promise<void>} - A promise that resolves when all commands, user and server connections are loaded.
     */
    async loadEverything() {
        await this.serverConnections._load();
        console.log(`[${this.shard.ids[0]}] Loaded all server connections.`);
        await this.userConnections._load();
        console.log(`[${this.shard.ids[0]}] Loaded all user connections.`);
        await this.serverSettingsConnections._load();
        console.log(`[${this.shard.ids[0]}] Loaded all server-settings connections.`);
        await this.userSettingsConnections._load();
        console.log(`[${this.shard.ids[0]}] Loaded all user-settings connections.`);
        await this._loadCommands();
        console.log(`[${this.shard.ids[0]}] Loaded all commands.`);
        await this._loadButtons();
        console.log(`[${this.shard.ids[0]}] Loaded all buttons.`);
    }
}
