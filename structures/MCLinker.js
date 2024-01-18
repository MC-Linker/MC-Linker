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
import MCLinkerAPI from './MCLinkerAPI.js';
import * as utils from '../utilities/utils.js';
import { convert } from '../scripts/convert.js';
import mongoose, { Mongoose, Schema } from 'mongoose';

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

        /**
         * The API instance of the bot.
         * @type {MCLinkerAPI}
         */
        this.api = new MCLinkerAPI(this);
    }

    async _loadCommands() {
        const commands = await fs.readdir(this.commandPath);

        const commandCategories = commands.filter(command => !command.endsWith('.js'));
        const commandFiles = commands.filter(command => command.endsWith('.js'));
        for(const file of commandFiles) await loadCommand.call(this, file);

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
     * Loads the mongodb database and all commands, user and server connections into the cache.
     * @returns {Promise<void>} - A promise that resolves when all commands, user and server connections are loaded.
     */
    async loadEverything() {
        await this.loadMongoose();
        console.log(`[${this.shard.ids[0]}] Loaded all mongo models: ${Object.keys(this.mongo.models).join(', ')}`);

        if(process.env.CONVERT === 'true' && this.shard.ids[0] === 0) {
            await convert(this.mongo);
            console.log('Converted database.');
        }

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

    async loadMongoose() {
        /**
         * The mongoose database client.
         * @type {Mongoose}
         */
        this.mongo = await mongoose.connect(process.env.DATABASE_URL);

        const serverConnectionSchema = new Schema({
            _id: { type: String },
            ip: String,
            version: Number,
            path: String,
            worldPath: String,
            online: Boolean,
            floodgatePrefix: String,
            requiredRoleToJoin: { method: { type: String, enum: ['all', 'any'] }, roles: [String] },
            displayIp: String,
            protocol: { type: String, enum: ['ftp', 'http', 'websocket'] },
            port: Number,
            username: String,
            password: String,
            token: String,
            hash: String,
            chatChannels: [{
                _id: { type: String },
                types: [{
                    type: String,
                    enum: ['chat', 'join', 'quit', 'advancement', 'death', 'player_command', 'console_command', 'block_command', 'start', 'close'],
                }],
                allowDiscordToMinecraft: Boolean,
                webhook: String,
            }],
            statChannels: [{
                _id: { type: String },
                type: { type: String, enum: ['online', 'max', 'members'] },
                names: {
                    online: String,
                    offline: String,
                    members: String,
                },
            }],
            syncedRoles: [{
                _id: { type: String },
                name: String,
                isGroup: Boolean,
                players: [String],
            }],
            serverSettings: { type: String, ref: 'ServerSettingsConnections' },
        });

        const serverSettingsConnectionSchema = new Schema({
            _id: { type: String },
            disabled: {
                advancements: [String],
                stats: [String],
                chatCommands: [String],
            },
            language: String,
            server: { type: String, ref: 'ServerConnection' },
        });

        const userSettingsConnectionSchema = new Schema({
            _id: { type: String },
            tokens: {
                accessToken: String,
                refreshToken: String,
                expires: Number,
            },
            user: { type: String, ref: 'UserConnection' },
        });

        const userConnectionSchema = new Schema({
            _id: { type: String },
            uuid: { type: String, unique: true },
            username: String,
            userSettings: { type: String, ref: 'UserSettingsConnection' },
        });

        this.mongo.model('ServerConnection', serverConnectionSchema);
        this.mongo.model('UserConnection', userConnectionSchema);
        this.mongo.model('ServerSettingsConnection', serverSettingsConnectionSchema);
        this.mongo.model('UserSettingsConnection', userSettingsConnectionSchema);
    }
}
