import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import { ComponentType, InteractionCollector, InteractionType, PermissionFlagsBits } from 'discord.js';
import { addTranslatedResponses, getComponent, getReplyOptions } from '../utilities/messages.js';
import { DefaultCollectorTimeout, disableComponents } from '../utilities/utils.js';
import CustomBotConnectionManager from '../structures/connections/managers/CustomBotConnectionManager.js';

export default class Customize extends Command {

    constructor() {
        super({
            name: 'customize',
            defer: true,
            requiresConnectedServer: false,
            allowUser: true,
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[]} args - No arguments.
     * @param {?ServerConnection} server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        // If user is not subscribed, let them customize server appearance
        if(!interaction.entitlements.find(e => e.skuId === CustomBotConnectionManager.CUSTOM_BOT_SKU_ID)) {
            if(!interaction.inGuild()) return await interaction.editReplyTl(keys.main.no_access.no_entitlement_guild);

            if(!interaction.memberPermissions.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
                return await interaction.editReplyTl(keys.main.no_access.no_permission_command, {
                    permission: 'Administrator / Manage Server',
                });
            }

            const messageOptions = getReplyOptions(keys.main.no_access.no_entitlement);
            const additionalButton = client.isCustomBot() ?
                getComponent(keys.commands.customize.buttons.custom_bot_change_presence) :
                getComponent(keys.commands.customize.buttons.customize_sku);
            messageOptions.components[0].components.push(additionalButton);

            const message = await interaction.followUp(messageOptions);

            const buttonCollector = message.createMessageComponentCollector({
                time: DefaultCollectorTimeout,
                componentType: ComponentType.Button,
            });
            buttonCollector.on('collect', async btnInteraction => {
                btnInteraction = addTranslatedResponses(btnInteraction);
                if(btnInteraction.customId === additionalButton.data.custom_id)
                    // Must be change presence button, because sku button does not emit event
                    await btnInteraction.showModalTl(keys.custom_bot.custom_bot_manager.change_presence_modal);
                else await btnInteraction.showModalTl(keys.commands.customize.customize_guild_appearance_modal);
            });
            buttonCollector.on('end', () => message.edit({ components: disableComponents(message.components) }));

            const modalCollector = new InteractionCollector(client, {
                time: DefaultCollectorTimeout,
                interactionType: InteractionType.ModalSubmit,
                message,
            });
            modalCollector.on('collect', async modalInteraction => {
                modalInteraction = addTranslatedResponses(modalInteraction);

                if(modalInteraction.customId === keys.custom_bot.custom_bot_manager.change_presence_modal.custom_id) {
                    // Change custom bot presence modal
                    const newPresence = client.customBots.parsePresenceModal(modalInteraction);
                    client.user.setPresence(newPresence);
                    await modalInteraction.replyTl(keys.custom_bot.custom_bot_manager.success.change_presence);
                }
                else { // Customize guild bot appearance modal
                    const nick = modalInteraction.fields.getTextInputValue('nickname') ?? null;
                    const bio = modalInteraction.fields.getTextInputValue('bio') ?? null;
                    const avatar = modalInteraction.fields.getUploadedFiles('avatar')?.first()?.url ?? null;
                    const banner = modalInteraction.fields.getUploadedFiles('banner')?.first()?.url ?? null;

                    try {
                        await interaction.guild.members.editMe({
                            nick,
                            avatar,
                            banner,
                            bio,
                            reason: `Customized bot appearance by ${interaction.user.displayName} (${interaction.user.id})`,
                        });
                    }
                    catch(err) {
                        client.analytics.trackError('component', 'Customize', interaction.guildId, interaction.user.id, err, null, logger);
                        return await modalInteraction.replyTl(keys.commands.customize.errors.guild_appearance_update_failed);
                    }
                    await modalInteraction.replyTl(keys.commands.customize.success.guild_appearance_updated);
                }
            });
            return;
        }

        if(client.customBots.hasCustomBot(interaction.user.id))
            await client.customBots.sendCustomBotManager(interaction, client.customBots.getCustomBot(interaction.user.id));
        else await client.customBots.sendCustomBotCreateWizard(interaction);
    }
}
