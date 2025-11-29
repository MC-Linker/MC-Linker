import Command from '../structures/Command.js';
import keys from '../utilities/keys.js';
import { ComponentType, InteractionCollector, InteractionType, PermissionFlagsBits } from 'discord.js';
import { addTranslatedResponses, getModal } from '../utilities/messages.js';

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

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        if(!interaction.entitlements.has('1166098447665995807')) {
            if(!interaction.inGuild()) return await interaction.replyTl(keys.commands.customize.warnings.no_entitlement_guild);

            if(!interaction.memberPermissions.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
                return await interaction.replyTl(keys.main.no_access.no_permission_command, {
                    permission: 'Administrator / Manage Server',
                });
            }
            const message = await interaction.replyTl(keys.commands.customize.warnings.no_entitlement);

            const buttonCollector = message.createMessageComponentCollector({
                time: 60_000 * 14,
                componentType: ComponentType.Button,
            });
            buttonCollector.on('collect', async buttonInteraction =>
                await buttonInteraction.showModal(getModal(keys.commands.customize.customize_guild_appearance_modal)));

            const modalCollector = new InteractionCollector(client, {
                time: 60_000 * 14,
                interactionType: InteractionType.ModalSubmit,
                message,
            });
            modalCollector.on('collect', async modalInteraction => {
                modalInteraction = addTranslatedResponses(modalInteraction);

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
                    return await modalInteraction.replyTl(keys.commands.customize.errors.guild_appearance_update_failed);
                }
                await modalInteraction.replyTl(keys.commands.customize.success.guild_appearance_updated);
            });
            return;
        }

        if(client.customBots.hasCustomBot(interaction.user.id))
            await client.customBots.sendCustomBotManager(interaction, client.customBots.getCustomBot(interaction.user.id));
        else await client.customBots.sendCustomBotCreateWizard(interaction);
    }
}
