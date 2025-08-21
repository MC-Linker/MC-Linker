import Connection from './Connection.js';
import logger from '../utilities/logger.js';
import { execSync } from 'child_process';
import fs from 'fs-extra';

export default class CustomBotConnection extends Connection {
    /**
     * @typedef {Object} CustomBotConnectionData
     * @property {string} id - The ID of the custom bot.\
     * @property {number} port - The port the custom bot is listening on.
     * @property {string} ownerId - The ID of the owner of the custom bot.
     */

    /**
     * @typedef {CustomBotConnection|string} CustomBotConnectionResolvable - Data that resolves to a CustomBotConnection object.
     */

    /**
     * Creates a new CustomBot instance.
     * @param {MCLinker} client - The client to create the custom bot for.
     * @param {CustomBotConnectionData} data - The data for this custom bot.
     */
    constructor(client, data) {
        super(client, data, 'CustomBotConnection');

        /**
         * The ID of the custom bot.
         * @type {string}
         */
        this.id = data.id;

        /**
         * The port the custom bot is listening on.
         * @type {number}
         */
        this.port = data.port;

        /**
         * The ID of the owner of the custom bot.
         * @type {string}
         */
        this.ownerId = data.ownerId;

        this.serviceName = `custom-mc-linker_${this.ownerId}`;
        this.dataFolder = `./Custom-MC-Linker/${this.ownerId}`;
    }

    /**
     * Initializes the custom bot connection.
     * This will create the necessary data folder and env file as well as build the docker image for the custom bot.
     * @param {string} token - The token to use for the custom bot.
     * @return {Promise<void>}
     */
    async init(token) {
        const env = {
            BOT_PORT: this.port,
            PLUGIN_PORT: process.env.PLUGIN_PORT,
            CLIENT_ID: this.id,
            CLIENT_SECRET: '',
            TOKEN: token,
            COOKIE_SECRET: crypto.randomUUID(),
            DISCORD_LINK: process.env.DISCORD_LINK,
            GUILD_ID: `\'${process.env.GUILD_ID}\'`,
            OWNER_ID: process.env.OWNER_ID,
            PLUGIN_VERSION: process.env.PLUGIN_VERSION,
            PREFIX: process.env.PREFIX,
            LINKED_ROLES_REDIRECT_URI: `http://api.mclinker.com:${this.port}/linked-role/callback`,
            MICROSOFT_EMAIL: process.env.MICROSOFT_EMAIL,
            MICROSOFT_PASSWORD: `\"${process.env.MICROSOFT_PASSWORD}\"`,
            AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
            IO_USERNAME: process.env.IO_USERNAME,
            IO_PASSWORD: crypto.randomUUID(),
            SERVICE_NAME: `custom-mc-linker_${this.ownerId}`,
            DATABASE_URL: `mongodb://mongodb:27017/custom-mc-linker_${this.ownerId}`,
            DATA_FOLDER: this.dataFolder,
            NODE_ENV: 'production',
        };

        const stringifiedEnv = Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n');
        await fs.outputFile(`${this.dataFolder}/.env`, stringifiedEnv);

        await fs.mkdir(`${this.dataFolder}/download-cache`);
        await fs.mkdir(`${this.dataFolder}/logs`);
        await logger.debug(`Custom bot data folder created at ${this.dataFolder}`);

        logger.info(execSync(`docker build . -t lianecx/${this.serviceName}`).toString());
    }

    /**
     * Checks if the custom bot connection is currently running.
     * @return {boolean}
     */
    isStarted() {
        return this.inspect().State?.Running ?? false;
    }

    /**
     * Returns docker inspection details for the custom bot connection.
     * @return {Object|null}
     */
    inspect() {
        try {
            const output = execSync(`docker inspect ${this.serviceName}`).toString();
            return JSON.parse(output)[0];
        }
        catch(err) {
            logger.error(err, `Failed to inspect custom bot connection`);
            return null;
        }
    }

    /**
     * Starts the custom bot connection using docker compose and listens for logs to confirm the bot is ready.
     * @return {Promise<void>}
     */
    start() {
        const composeProcess = spawn('docker', ['compose', '-f', './docker-compose-custom.yml', 'up', '-d', this.serviceName], {
            env: {
                DATA_FOLDER: this.dataFolder,
                SERVICE_NAME: this.serviceName,
            },
            stdio: 'pipe',
        });

        // Check logs until the bot is ready
        return new Promise((resolve, reject) => {
            const checkLogsTimeout = setTimeout(() => {
                clearInterval(checkLogsInterval);
                this.down();
                reject(new Error('Timeout waiting for bot to start'));
            }, 60_000);

            const checkLogsInterval = setInterval(() => {
                try {
                    const logs = execSync(`docker logs ${this.serviceName} --tail 10`).toString();

                    if(logs.includes(`Server listening at http://0.0.0.0:${this.port}`)) {
                        logger.info('Custom bot is ready!');
                        clearInterval(checkLogsInterval);
                        clearTimeout(checkLogsTimeout);
                        resolve();
                    }
                }
                catch(err) {
                    // Container might not be ready yet, continue checking
                }
            }, 1000, 1000);

            composeProcess.on('close', code => {
                if(code !== 0) {
                    clearInterval(checkLogsInterval);
                    clearTimeout(checkLogsTimeout);
                    this.down();
                    reject(new Error(`Docker compose failed with code ${code}`));
                }
            });

            composeProcess.on('error', err => {
                clearInterval(checkLogsInterval);
                clearTimeout(checkLogsTimeout);
                this.down();
                reject(err);
            });
        });
    }

    /**
     * Stops the docker container for this custom bot.
     * @return {string} - The output of the docker command.
     */
    stop() {
        logger.debug(`Stopping custom bot container ${this.serviceName}`);
        try {
            return execSync(`docker compose -f docker-compose-custom.yml stop ${this.serviceName}`).toString();
        }
        catch(err) {
            logger.error(err, `Failed to stop custom bot container ${this.serviceName}`);
            return '';
        }
    }

    /**
     * Shuts down and removes the docker container for this custom bot.
     * @return {string} - The output of the docker command.
     */
    down() {
        logger.debug(`Shutting down and removing custom bot container ${this.serviceName}`);

        try {
            return execSync(`docker compose -f docker-compose-custom.yml down ${this.serviceName}`).toString();
        }
        catch(err) {
            logger.error(err, `Failed to shut down custom bot container ${this.serviceName}`);
            return '';
        }
    }

    /**
     * Removes the custom bot data folder from the filesystem.
     * @return {Promise<void>}
     */
    async removeDataFolder() {
        logger.debug(`Removing custom bot data folder ${this.dataFolder}`);
        await fs.remove(this.dataFolder);
    }

    getData() {
        return {
            id: this.id,
            port: this.port,
            ownerId: this.ownerId,
        };
    }
}