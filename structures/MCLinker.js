const Discord = require('discord.js');
const ServerConnectionManager = require('./ServerConnectionManager');
const UserConnectionManager = require('./UserConnectionManager');
const fs = require('fs-extra');
const Command = require('./Command');
const { keys, addPh } = require('../api/messages');
const path = require('path');

class MCLinker extends Discord.Client {

    /**
     * Creates a new MCLinker client instance.
     * @param {string} commandPath - The path to the commands folder.
     * @param {Discord.ClientOptions} options - The options to pass to the Discord.js client.
     * @returns {MCLinker} - The new MCLinker client instance.
     */
    constructor(commandPath = './commands', options = {
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
         * A collection of all commands in this bot.
         * @type {Map<string, Command>}
         */
        this.commands = new Discord.Collection();

        /**
         * The path to the commands folder.
         * @type {string}
         */
        this.commandPath = commandPath;
    }

    async _loadCommands() {
        const commandCategories = await fs.readdir(this.commandPath);
        for(const category of commandCategories) {
            const commandFiles = await fs.readdir(`${this.commandPath}/${category}`);

            for(const file of commandFiles) {
                // noinspection LocalVariableNamingConventionJS
                const CommandFile = require(path.resolve(`${this.commandPath}/${category}/${file}`));
                if(CommandFile.prototype instanceof Command) {
                    const command = new CommandFile();

                    this.commands.set(command.name, command);
                    console.log(addPh(keys.main.success.command_load.console, { command: command.name, category: category }));
                }
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
        await this._loadCommands();
    }
}

module.exports = MCLinker;
