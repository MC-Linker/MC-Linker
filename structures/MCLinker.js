import Discord from 'discord.js';
import ServerConnectionManager from './ServerConnectionManager.js';
import UserConnectionManager from './UserConnectionManager.js';
import SettingsConnectionManager from './SettingsConnectionManager.js';
import fs from 'fs-extra';
import { addPh } from '../api/messages.js';
import keys from '../api/keys.js';
import path from 'path';
import Command from './Command.js';
import Button from './Button.js';

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
     * @type {SettingsConnectionManager}
     */
    settingsConnections;

    /**
     * A collection of all commands in this bot.
     * @type {Collection<string, Command>}
     */
    commands = new Discord.Collection();

    /**
     * A collection of all buttons in this bot.
     * @type {Collection<string, Button>}
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
         * The settings-connection manager for the bot.
         * @type {SettingsConnectionManager}
         */
        this.settingsConnections = new SettingsConnectionManager(this);

        /**
         * A collection of all commands in this bot.
         * @type {Collection<string, Command>}
         */
        this.commands = new Discord.Collection();

        /**
         * A collection of all buttons in this bot.
         * @type {Collection<string, Button>}
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

                this.commands.set(command.name, command);
                console.log(addPh(
                    category ? keys.main.success.command_load_category.console : keys.main.success.command_load.console,
                    { command: command.name, category: category },
                ));
            }
        }
    }

    async _loadButtons() {
        const buttonFiles = (await fs.readdir(this.buttonPath))
            .filter(file => file.endsWith('.js'));

        for(const file of buttonFiles) {
            // noinspection LocalVariableNamingConventionJS
            const ButtonFile = await import(`file://${path.resolve(`${this.buttonPath}/${file}`)}`);
            if(ButtonFile.prototype instanceof Button) {
                const button = new ButtonFile();

                this.buttons.set(button.id, button);
                console.log(addPh(keys.main.success.button_load.console, { button: button.id }));
            }
        }
    }

    /**
     * Loads all commands, user and server connections into the cache
     * @returns {Promise<void>} - A promise that resolves when all commands, user and server connections are loaded.
     */
    async loadEverything() {
        await this.serverConnections._load();
        console.log('Loaded all server connections.');
        await this.userConnections._load();
        console.log('Loaded all user connections.');
        await this.settingsConnections._load();
        console.log('Loaded all settings connections.');
        await this._loadCommands();
        console.log('Loaded all commands.');
        await this._loadButtons();
        console.log('Loaded all buttons.');
    }
}
