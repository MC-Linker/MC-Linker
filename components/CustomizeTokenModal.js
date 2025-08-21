import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import Discord, { GatewayIntentBits, OAuth2Scopes, PermissionsBitField } from 'discord.js';
import logger from '../utilities/logger.js';
import { exposeCustomBotPorts } from '../utilities/oci.js';
import { execSync } from 'child_process';
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
        await interaction.replyTl(keys.custom_bot.create.step.logging_in);

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
            if(err.code === 'TokenInvalid' || err.code === 'UND_ERR_INVALID_ARG')
                return await interaction.replyTl(keys.custom_bot.create.warnings.invalid_token);
            else if(err.message === 'Used disallowed intents')
                return await interaction.replyTl(keys.custom_bot.create.warnings.no_intents);
            else throw err; // Rethrow other errors
        }
        finally {
            await testClient.destroy();
        }

        //TODO For linked roles they'll have to add endpoints in the portal and provide the secret


        const botPort = client.customBots.getNewAvailablePort();

        /** @type {CustomBotConnection} */
        const customBotConnection = await client.customBots.connect({
            id: testClient.user.id,
            port: botPort,
            ownerId: interaction.user.id,
        });

        await interaction.replyTl(keys.custom_bot.create.step.building);
        logger.info(execSync(`docker build . -t lianecx/${customBotConnection.serviceName}`).toString());

        try {
            await interaction.replyTl(keys.custom_bot.create.step.starting_up);
            await customBotConnection.init(token);
            await customBotConnection.start();
        }
        catch(err) {
            logger.error(`Failed to start custom bot ${customBotConnection.serviceName}:`, err);
            await client.customBots.disconnect(customBotConnection);
            await interaction.replyTl(keys.custom_bot.errors.start_failed);
        }

        await interaction.replyTl(keys.custom_bot.create.step.deploying);
        logger.info(execSync(`docker exec ${customBotConnection.serviceName} node scripts/deploy.js deploy -g`).toString());

        await exposeCustomBotPorts(...client.customBots.getPortRange());

        const wizard = new Wizard(client, interaction, [
            keys.custom_bot.create.success.port,
            keys.custom_bot.create.success.finish,
        ].map(key => getReplyOptions(key, { port: botPort, invite }, ph.emojisAndColors())), {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });
        await wizard.start();
    }
}