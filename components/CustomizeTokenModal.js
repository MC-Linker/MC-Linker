import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import Discord, { GatewayIntentBits, OAuth2Scopes, PermissionsBitField } from 'discord.js';
import fs from 'fs-extra';
import logger from '../utilities/logger.js';
import { exposeCustomBotPorts } from '../utilities/oci.js';
import { execSync, spawn } from 'child_process';
import Wizard from '../structures/helpers/Wizard.js';
import { getReplyOptions, ph } from '../utilities/messages.js';

export default class CustomizeTokenModal extends Component {

    constructor() {
        super({
            type: 'ModalSubmit',
            id: 'customize_token_modal',
            defer: false,
            sku: '1166098447665995807',
        });
    }

    async execute(interaction, client) {
        if(!await super.execute(interaction, client)) return;

        const token = interaction.fields.getTextInputValue('token');
        await interaction.replyTl(keys.commands.customize.success.logging_in);

        let invite;
        const testClient = new Discord.Client({
            intents: [
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
            ],
        });
        try {
            await testClient.login(token);
            invite = testClient.generateInvite({
                scopes: [
                    OAuth2Scopes.ApplicationsCommands,
                    OAuth2Scopes.Bot,
                ],
                permissions: [
                    PermissionsBitField.Flags.CreateInstantInvite,
                    PermissionsBitField.Flags.ManageWebhooks,
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.SendMessagesInThreads,
                    PermissionsBitField.Flags.EmbedLinks,
                    PermissionsBitField.Flags.AttachFiles,
                    PermissionsBitField.Flags.UseExternalEmojis,
                ],
            });
        }
        catch(err) {
            console.log(err);
            if(err.code === 'TokenInvalid' || err.code === 'UND_ERR_INVALID_ARG')
                return await interaction.replyTl(keys.commands.customize.warnings.invalid_token);
            else if(err.message === 'Used disallowed intents')
                return await interaction.replyTl(keys.commands.customize.warnings.no_intents);
            else throw err; // Rethrow other errors
        }
        finally {
            await testClient.destroy();
        }

        //For linked roles they'll have to add endpoints in the portal and provide the secret

        const botFolder = `./Custom-MC-Linker/${interaction.user.id}`;
        if(await fs.exists(botFolder)) console.log(execSync('git pull', { cwd: botFolder }).toString());
        else {
            // Clone MC-Linker to ../../Custom-MC-Linker/<author_id>
            await interaction.replyTl(keys.commands.customize.success.cloning);
            //TODO remove branch dev
            logger.info(execSync(`git clone https://github.com/MC-Linker/MC-Linker --branch dev ${botFolder}`).toString());
            // Copy docker-compose.yml
            await fs.copy('./docker-compose-custom.yml', `${botFolder}/docker-compose.yml`);
            await fs.copy('./oci', `${botFolder}/oci`);
            await fs.mkdir(`${botFolder}/download-cache`);
            await fs.mkdir(`${botFolder}/logs`);
        }

        const botPort = client.customBots.getNewAvailablePort();
        const env = {
            BOT_PORT: botPort,
            PLUGIN_PORT: process.env.PLUGIN_PORT,
            CLIENT_ID: testClient.user.id,
            CLIENT_SECRET: '',
            TOKEN: token,
            COOKIE_SECRET: crypto.randomUUID(),
            DISCORD_LINK: process.env.DISCORD_LINK,
            GUILD_ID: `\'${process.env.GUILD_ID}\'`,
            OWNER_ID: process.env.OWNER_ID,
            PLUGIN_VERSION: process.env.PLUGIN_VERSION,
            PREFIX: process.env.PREFIX,
            LINKED_ROLES_REDIRECT_URI: `http://api.mclinker.com:${botPort}/linked-role/callback`,
            MICROSOFT_EMAIL: process.env.MICROSOFT_EMAIL,
            MICROSOFT_PASSWORD: `\"${process.env.MICROSOFT_PASSWORD}\"`,
            AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
            IO_USERNAME: process.env.IO_USERNAME,
            IO_PASSWORD: crypto.randomUUID(),
            SERVICE_NAME: `custom-mc-linker_${interaction.user.id}`,
            DATABASE_URL: `mongodb://mongodb:27017/custom-mc-linker_${interaction.user.id}`,
            NODE_ENV: 'production',
        };

        const stringifiedEnv = Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n');
        await fs.writeFile(`${botFolder}/.env`, stringifiedEnv);

        await interaction.replyTl(keys.commands.customize.success.starting_up);
        logger.info(execSync(`docker build . -t lianecx/${env.SERVICE_NAME}`, { cwd: botFolder, env }).toString());

        const composeProcess = spawn('docker', ['compose', 'up', '-d'], {
            cwd: botFolder,
            env,
            stdio: 'pipe',
        });

        // Check logs until the bot is ready
        await new Promise((resolve, reject) => {
            const checkLogsInterval = setInterval(async () => {
                try {
                    const logs = execSync(`docker logs ${env.SERVICE_NAME} --tail 10`, {
                        cwd: botFolder,
                        encoding: 'utf8',
                    });

                    if(logs.includes(`Server listening at http://0.0.0.0:${botPort}`)) {
                        logger.info('Custom bot is ready!');
                        clearInterval(checkLogsInterval);
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
                    execSync(`docker compose down`, { cwd: botFolder });
                    reject(new Error(`Docker compose failed with code ${code}`));
                }
            });

            composeProcess.on('error', err => {
                clearInterval(checkLogsInterval);
                execSync(`docker compose down`, { cwd: botFolder });
                reject(err);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkLogsInterval);
                execSync(`docker compose down`, { cwd: botFolder });
                reject(new Error('Timeout waiting for bot to start'));
            }, 30_000);
        });

        await interaction.replyTl(keys.commands.customize.success.deploying);
        logger.info(execSync(`docker exec ${env.SERVICE_NAME} node scripts/deploy.js deploy -g`, {
            cwd: botFolder,
            env,
        }).toString());

        await exposeCustomBotPorts(...this.customBots.getPortRange());

        await client.customBots.connect({
            id: env.CLIENT_ID,
            port: botPort,
            ownerId: interaction.user.id,
        });

        const wizard = new Wizard(client, interaction, [
            keys.commands.customize.success.port,
            keys.commands.customize.success.finish,
        ].map(key => getReplyOptions(key, { port: botPort, invite }, ph.emojisAndColors())), {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });
        await wizard.start();
        return await interaction.replyTl(keys.commands.customize.success.port, { port: botPort, invite });
    }
}