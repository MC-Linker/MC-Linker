import Connection from './Connection.js';
import logger from '../utilities/logger.js';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import { execAsync } from '../utilities/utils.js';
import crypto from 'crypto';

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

        /**
         * The communication token used to authenticate with the custom bot.
         * @type {string}
         */
        this.communicationToken = crypto.randomBytes(32).toString('hex');

        /**
         * The name of the docker container for this custom bot.
         * @type {`custom-mc-linker_${ownerId}`}
         */
        this.containerName = `custom-mc-linker_${this.ownerId}`;

        /**
         * The folder where the custom bot's data is stored.
         * @type {`./Custom-MC-Linker/${ownerId}`}
         */
        this.dataFolder = `./Custom-MC-Linker/${this.ownerId}`;

        /**
         * The env passed to docker commands.
         * @type {{ DATA_FOLDER: string, CONTAINER_NAME: string, BOT_PORT: number }}
         */
        this.dockerEnv = {
            DATA_FOLDER: this.dataFolder,
            CONTAINER_NAME: this.containerName,
            BOT_PORT: this.port,
        };
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
            CUSTOM_BOT: 'true',
            COMMUNICATION_TOKEN: this.communicationToken,
        };

        const stringifiedEnv = Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n');
        await fs.outputFile(`${this.dataFolder}/.env`, stringifiedEnv);

        await fs.mkdir(`${this.dataFolder}/download-cache`);
        await fs.mkdir(`${this.dataFolder}/logs`);
        await logger.info(`Custom bot data folder created at ${this.dataFolder}`);

        await this.build();
    }

    /**
     * Checks if the custom bot connection is currently running.
     * @return {Promise<boolean>}
     */
    async isStarted() {
        return (await this.inspect())?.State?.Running ?? false;
    }

    /**
     * Returns docker inspection details for the custom bot connection.
     * @return {Promise<?Object>}
     */
    async inspect() {
        try {
            const { stdout } = await execAsync(`docker inspect ${this.containerName}`);
            return JSON.parse(stdout)[0];
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Builds the docker image for the custom bot connection.
     * @return {Promise<void>}
     */
    async build() {
        logger.info(`Building custom bot ${this.containerName}`);
        logger.info((await execAsync(`docker build . -t lianecx/${this.containerName}`)).stdout);
    }

    /**
     * Updates the custom bot connection by rebuilding the docker image and restarting the container.
     * Equivalent to calling `build()`, `stop()`, and `start()` in sequence.
     * @return {Promise<void>}
     */
    async update() {
        logger.info(`Updating custom bot ${this.containerName}`);
        await this.build();
        await this.stop();
        return await this.start();
    }

    /**
     * Starts the custom bot connection using docker compose and listens for logs to confirm the bot is ready.
     * @return {Promise<void>}
     */
    start() {
        const composeProcess = spawn('docker', ['compose', '-f', './docker-compose-custom.yml', 'up', '-d', 'custom-mc-linker'], {
            env: this.dockerEnv,
            stdio: 'inherit',
        });

        // Check logs until the bot is ready
        return new Promise((resolve, reject) => {
            const checkLogsTimeout = setTimeout(() => {
                reject(new Error('Timeout waiting for bot to start'));
                clearInterval(checkLogsInterval);

                try {
                    this.down();
                }
                catch(_) {}
            }, 60_000);

            const checkLogsInterval = setInterval(async () => {
                try {
                    const { stdout: logs } = await execAsync(`docker logs ${this.containerName} --tail 10`);

                    if(logs.includes(`Server listening at http://0.0.0.0:${this.port}`)) {
                        logger.info('Custom bot is ready!');
                        resolve();
                        clearInterval(checkLogsInterval);
                        clearTimeout(checkLogsTimeout);
                    }
                }
                catch(_) {} // Container might not be ready yet, continue checking
            }, 1000, 1000);

            composeProcess.on('close', code => {
                if(code !== 0) {
                    reject(new Error(`Docker compose failed with code ${code}`));
                    clearInterval(checkLogsInterval);
                    clearTimeout(checkLogsTimeout);

                    try {
                        this.down();
                    }
                    catch(_) {}
                }
            });

            composeProcess.on('error', err => {
                reject(err);
                clearInterval(checkLogsInterval);
                clearTimeout(checkLogsTimeout);
                this.down();
            });
        });
    }

    /**
     * Stops the docker container for this custom bot.
     * @return {Promise<string>} - The output of the docker command.
     */
    async stop() {
        logger.info(`Stopping custom bot container ${this.containerName}`);

        return (await execAsync(`docker compose -f docker-compose-custom.yml stop custom-mc-linker`, {
            env: this.dockerEnv,
        })).stdout;
    }

    /**
     * Shuts down and removes the docker container for this custom bot.
     * @return {Promise<string>} - The output of the docker command.
     */
    async down() {
        logger.info(`Shutting down and removing custom bot container ${this.containerName}`);

        return (await execAsync(`docker compose -f docker-compose-custom.yml down custom-mc-linker --rmi all --volumes`, {
            env: this.dockerEnv,
        })).stdout;
    }

    /**
     * Sends a presence update to the custom bot via HTTP.
     * @param {import('discord.js').PresenceData} presence - The presence data to set.
     * @return {Promise<boolean>}
     */
    async setPresence(presence) {
        return await this.communicate('presence', presence);
    }

    async communicate(path, data = {}, method = 'POST') {
        const response = await fetch(`http://${this.containerName}:${this.port}/${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-communication-token': this.communicationToken,
            },
            body: JSON.stringify(data),
        });

        if(!response.ok) {
            logger.error(response.error, `Failed to communicate with custom bot ${this.containerName} at path /${path}`);
            return false;
        }
        else return true;
    }

    /**
     * Removes the custom bot data folder from the filesystem.
     * @return {Promise<void>}
     */
    async removeDataFolder() {
        logger.info(`Removing custom bot data folder ${this.dataFolder}`);
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