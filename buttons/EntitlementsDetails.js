import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getModal, getReplyOptions, ph } from '../utilities/messages.js';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import Discord from 'discord.js';

export default class EntitlementsDetails extends Button {

    constructor() {
        super({ id: 'entitlements_details', defer: false });
    }

    async execute(interaction, client) {
        if(interaction.entitlements.size === 0) {
            if(process.env.NODE_ENV === 'production') return await interaction.update(getReplyOptions(keys.warnings.errors.no_entitlement));
            else return;
        }

        try {
            //Send modal
            await interaction.showModal(getModal(keys.entitlements.success.details_modal));
            const modal = await interaction.awaitModalSubmit({ time: 300_000 });
            const token = modal.fields.getTextInputValue('token');

            console.log(token);
            await interaction.replyTl(keys.entitlements.success.logging_in);
            await modal.deferUpdate();

            const testClient = new Discord.Client({
                intents: [
                    Discord.GatewayIntentBits.GuildMessages,
                    Discord.GatewayIntentBits.GuildMembers,
                ],
            });
            try {
                await testClient.login(token);
            }
            catch(err) {
                console.log(err);
                return await interaction.replyTl(keys.entitlements.warnings.invalid_token, ph.error(err));
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
                console.log(execSync(`git clone https://github.com/MC-Linker/MC-Linker ${botFolder}`).toString());
                // Copy docker-compose.yml
                await fs.copy('./docker-compose-custom.yml', `${botFolder}/docker-compose.yml`);
                await fs.mkdir(`${botFolder}/download-cache`);
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

            //TODO Create database

            execSync(`docker build . -t lianecx/${env.SERVICE_NAME} && docker compose up -d`, { cwd: botFolder, env });

            //Check for errors (wrong secret etc)

            // Run slash command script
            await interaction.replyTl(keys.entitlements.success.deploying);

            //TODO does not work
            execSync(`docker exec ${env.SERVICE_NAME} node scripts/deploy.js deploy -g`, { cwd: botFolder, env });

            //TODO port expose

            //Send success

            // Tell them to change bot port in the plugin config / run command

            return await interaction.replyTl(keys.entitlements.success.finish, { port: botPort }); //TODO Add control buttons (start/stop, edit details)
        }
        catch(e) {
            console.error(e);
        }
    }
}