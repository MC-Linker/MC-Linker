const Discord = require('discord.js');
const ServerConnectionManager = require('./ServerConnectionManager');
const UserConnectionManager = require('./UserConnectionManager');
const SettingsConnectionManager = require('./SettingsConnectionManager');
const fs = require('fs-extra');
const { addPh } = require('../api/messages');
const { keys } = require('../api/keys');
const path = require('path');
const Command = require('./Command');
const Button = require('./Button');

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
        const commands = await fs.readdir(this.commandPath);

        const commandCategories = commands.filter(command => !command.endsWith('.js'));
        const commandFiles = commands.filter(command => command.endsWith('.js'));
        commandFiles.forEach(file => loadCommand.call(this, file));

        for(const category of commandCategories) {
            const commandFiles = (await fs.readdir(`${this.commandPath}/${category}`))
                .filter(file => file.endsWith('.js'));

            for(const file of commandFiles) loadCommand.call(this, file, category);
        }

        function loadCommand(file, category = null) {
            // noinspection LocalVariableNamingConventionJS
            const CommandFile = category ?
                require(path.resolve(`${this.commandPath}/${category}/${file}`)) :
                require(path.resolve(`${this.commandPath}/${file}`));

            if(CommandFile.prototype instanceof Command) {
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
            const ButtonFile = require(path.resolve(`${this.buttonPath}/${file}`));
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
        await this.userConnections._load();
        await this.settingsConnections._load();
        await this._loadCommands();
        await this._loadButtons();
    }
}

module.exports = MCLinker;
