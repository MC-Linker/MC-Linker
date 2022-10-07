const Discord = require('discord.js');
const ServerConnectionManager = require('./ServerConnectionManager');
const UserConnectionManager = require('./UserConnectionManager');
const SettingsConnectionManager = require('./SettingsConnectionManager');
const fs = require('fs-extra');
const { keys, addPh } = require('../api/messages');
const path = require('path');

class MCLinker extends Discord.Client {

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
         * @type {Map<string, Command>}
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
        const commandCategories = await fs.readdir(this.commandPath);
        for(const category of commandCategories) {
            const commandFiles = await fs.readdir(`${this.commandPath}/${category}`);

            for(const file of commandFiles) {
                // noinspection LocalVariableNamingConventionJS
                const Command = require(path.resolve(`${this.commandPath}/${category}/${file}`));
                if(Command.prototype instanceof Command) {
                    const command = new Command();

                    this.commands.set(command.name, command);
                    console.log(addPh(keys.main.success.command_load.console, { command: command.name, category: category }));
                }
            }
        }
    }

    async _loadButtons() {
        const buttonFiles = await fs.readdir(this.buttonPath);

        for(const file of buttonFiles) {
            // noinspection LocalVariableNamingConventionJS
            const Button = require(path.resolve(`${this.buttonPath}/${file}`));
            if(Button.prototype instanceof Button) {
                const button = new Button();

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
        await this.userConnections._load();
        await this.settingsConnections._load();
        await this._loadCommands();
        await this._loadButtons();
    }
}

module.exports = MCLinker;
