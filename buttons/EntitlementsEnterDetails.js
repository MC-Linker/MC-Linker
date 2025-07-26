import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getModal, getReplyOptions } from '../utilities/messages.js';
import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import Discord, { OAuth2Scopes, PermissionsBitField } from 'discord.js';
import { exposeCustomBotPorts } from '../utilities/oci.js';
import logger from '../utilities/logger.js';

export default class EntitlementsEnterDetails extends Button {

    constructor() {
        super({ id: 'entitlements_enter_details', defer: false });
    }

    async execute(interaction, client) {
        if(interaction.entitlements.size === 0 && process.env.NODE_ENV === 'production')
            return await interaction.update(getReplyOptions(keys.warnings.errors.no_entitlement));

        //Send modal
        await interaction.showModal(getModal(keys.entitlements.success.details_modal));
        const modal = await interaction.awaitModalSubmit({ time: 300_000 });
        const token = modal.fields.getTextInputValue('token');

        await modal.deferUpdate();
        console.log(token);
        await interaction.replyTl(keys.entitlements.success.logging_in);

        let invite;

        const testClient = new Discord.Client({
            intents: [
                Discord.GatewayIntentBits.GuildMessages,
                Discord.GatewayIntentBits.GuildMembers,
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
            if(err.code === 'TokenInvalid')
                return await interaction.replyTl(keys.entitlements.warnings.invalid_token);
            else if(err.message === 'Used disallowed intents')
                return await interaction.replyTl(keys.entitlements.warnings.no_intents);
        }
        finally {
            await testClient.destroy();
        }

        //For linked roles they'll have to add endpoints in the portal and provide the secret

        const botFolder = `./Custom-MC-Linker/${interaction.user.id}`;
        if(await fs.exists(botFolder)) console.log(execSync('git pull', { cwd: botFolder }).toString());
        else {
            // Clone MC-Linker to ../../Custom-MC-Linker/<author_id>
            await interaction.replyTl(keys.entitlements.success.cloning);
            //TODO remove branch dev
            logger.info(execSync(`git clone https://github.com/MC-Linker/MC-Linker --branch dev ${botFolder}`).toString());
            // Copy docker-compose.yml
            await fs.copy('./docker-compose-custom.yml', `${botFolder}/docker-compose.yml`);
            await fs.copy('./oci', `${botFolder}/oci`);
            await fs.mkdir(`${botFolder}/download-cache`);
            await fs.mkdir(`${botFolder}/logs`);
        }

        const botPort = 30000; //TODO
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
            SERVICE_NAME: `custom-mc-linker_${interaction.user.id}`,
            DATABASE_URL: `mongodb://mongodb:27017/custom-mc-linker_${interaction.user.id}`,
            NODE_ENV: 'production',
        };

        const stringifiedEnv = Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n');
        await fs.writeFile(`${botFolder}/.env`, stringifiedEnv);

        await interaction.replyTl(keys.entitlements.success.starting_up);
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

        await interaction.replyTl(keys.entitlements.success.deploying);
        logger.info(execSync(`docker exec ${env.SERVICE_NAME} node scripts/deploy.js deploy -g`, {
            cwd: botFolder,
            env,
        }).toString());

        // TODO
        await exposeCustomBotPorts(botPort, botPort);

        return await interaction.replyTl(keys.entitlements.success.port, { port: botPort, invite });
    }
}