import Component from '../structures/Component.js';
import keys from '../utilities/keys.js';
import Discord, { AttachmentBuilder, OAuth2Scopes, PermissionsBitField, Routes } from 'discord.js';
import logger from '../utilities/logger.js';
import { exposeCustomBotPorts } from '../utilities/oci.js';
import Wizard from '../structures/helpers/Wizard.js';
import { addTranslatedResponses, getReplyOptions, ph } from '../utilities/messages.js';
import { execAsync } from '../utilities/utils.js';

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
        const testClient = new Discord.Client({ intents: [] });
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

            //Enable privileged intents
            const guildMembersIntent = 1 << 15;
            const messageContentIntent = 1 << 19;
            await testClient.rest.patch(Routes.currentApplication(), {
                body: {
                    flags: guildMembersIntent | messageContentIntent,
                },
            });
        }
        catch(err) {
            if(err.code === 'TokenInvalid' || err.code === 'UND_ERR_INVALID_ARG') {
                const invalidTokenOptions = getReplyOptions(keys.custom_bot.create.warnings.invalid_token, ph.emojisAndColors());
                return await interaction.replyOptions({
                    ...invalidTokenOptions,
                    files: [
                        new AttachmentBuilder('./resources/images/custom_bot/reset_token.png', { name: 'invalid_token.gif' }),
                    ],
                });
            }
            else throw err; // Rethrow other errors
        }
        finally {
            await testClient.destroy();
        }

        //TODO For linked roles they'll have to add endpoints in the portal and provide the secreta

        const botPort = client.customBots.getNewAvailablePort();

        /** @type {CustomBotConnection} */
        const customBotConnection = await client.customBots.connect({
            id: testClient.user.id,
            port: botPort,
            ownerId: interaction.user.id,
        });

        try {
            await interaction.replyTl(keys.custom_bot.create.step.building);
            await customBotConnection.init(token);

            await interaction.replyTl(keys.custom_bot.create.step.starting_up);
            await customBotConnection.start();
        }
        catch(err) {
            logger.error(err, `Failed to start custom bot ${customBotConnection.containerName}`);
            await client.customBots.disconnect(customBotConnection);
            return await interaction.replyTl(keys.custom_bot.errors.start_failed);
        }

        await interaction.replyTl(keys.custom_bot.create.step.deploying);
        // TODO add deploy -r for linked roles
        logger.info((await execAsync(`docker exec ${customBotConnection.containerName} node scripts/deploy.js deploy -g`, {
            env: customBotConnection.dockerEnv,
        })).stdout);

        await exposeCustomBotPorts(...client.customBots.getPortRange());

        const wizard = new Wizard(client, interaction, [
            keys.custom_bot.create.success.port,
            keys.custom_bot.create.success.finish,
        ].map(key => getReplyOptions(key, { port: botPort, invite }, ph.emojisAndColors())), {
            timeout: 60_000 * 14, // 15 minutes is max interaction timeout
        });
        const message = await wizard.start();

        const collector = message.createMessageComponentCollector({
            time: Wizard.DEFAULT_TIMEOUT,
            componentType: Discord.ComponentType.Button,
            filter: btnInteraction => btnInteraction.customId === 'customize_manage_bot',
            max: 1,
        });
        collector.on('collect', async btnInteraction => {
            btnInteraction = addTranslatedResponses(btnInteraction);
            await client.customBots.sendCustomBotManager(btnInteraction, customBotConnection);
        });
    }
}