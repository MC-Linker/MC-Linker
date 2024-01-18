import Discord, { PermissionFlagsBits } from 'discord.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import keys, { getLanguageKey } from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import * as utils from '../../utilities/utils.js';
import { canSendMessages } from '../../utilities/utils.js';
import Pagination from '../../structures/helpers/Pagination.js';

export default class ChatChannel extends Command {

    constructor() {
        super({
            name: 'chatchannel',
            requiresConnectedPlugin: true,
            category: 'settings',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];

        //Add chatchannel
        if(subcommand === 'add') {
            /** @type {Discord.BaseGuildTextChannel} */
            const channel = args[1];
            const allowDiscordToMinecraft = args[2] ?? true;
            const useWebhooks = args[3] ?? true;

            if(!canSendMessages(interaction.guild.members.me, channel)) return interaction.replyTl(keys.api.utils.errors.not_sendable);
            else if(useWebhooks && !channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageWebhooks)) {
                return interaction.replyTl(keys.api.plugin.errors.no_webhook_permission);
            }

            const logChooserMsg = await interaction.replyTl(keys.commands.chatchannel.step.choose);
            let menu;
            try {
                menu = await logChooserMsg.awaitMessageComponent({
                    componentType: Discord.ComponentType.StringSelect,
                    time: 180_000,
                    filter: m => m.user.id === interaction.user.id && m.customId === 'log',
                });
            }
            catch(_) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.not_collected);
            }

            //Create webhook for channel
            let webhook;
            if(useWebhooks && menu.values.includes('chat')) {
                try {
                    if(channel.isThread()) webhook = await channel.parent.createWebhook({
                        name: 'ChatChannel',
                        reason: 'ChatChannel to Minecraft',
                    });
                    else webhook = await channel.createWebhook({
                        name: 'ChatChannel',
                        reason: 'ChatChannel to Minecraft',
                    });
                }
                catch(_) {
                    return interaction.replyTl(keys.commands.chatchannel.errors.could_not_create_webhook);
                }
            }

            const resp = await server.protocol.addChatChannel({
                id: channel.id,
                webhook: webhook?.id,
                types: menu.values,
                allowDiscordToMinecraft,
            });
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return webhook?.delete();

            await server.edit({ chatChannels: resp.data });

            return interaction.replyTl(keys.commands.chatchannel.success.add, ph.emojisAndColors());
        }
        else if(subcommand === 'remove') {
            const channel = args[1];

            const chatChannel = server.chatChannels.find(c => c.id === channel.id);
            if(!chatChannel) return interaction.replyTl(keys.commands.chatchannel.warnings.channel_not_added);

            const resp = await server.protocol.removeChatChannel(chatChannel);
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

            await server.edit({ chatChannels: resp.data });
            return interaction.replyTl(keys.commands.chatchannel.success.remove);
        }
        else if(subcommand === 'list') {
            if(!server.chatChannels?.length) return interaction.replyTl(keys.commands.chatchannel.warnings.no_channels);

            /** @type {PaginationPages} */
            const pages = {};

            for(const channel of server.chatChannels) {
                const options = getLanguageKey(keys.commands.chatchannel.step.choose.components[0].options);
                const formattedTypes = channel.types.map(type => options.find(o => o.value === type).label).join(',\n');

                const channelEmbed = getEmbed(
                    keys.commands.chatchannel.success.list,
                    ph.std(interaction),
                    {
                        channel: await interaction.guild.channels.fetch(channel.id),
                        webhooks: channel.webhook ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
                        discord_to_minecraft: channel.allowDiscordToMinecraft ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
                        channel_types: formattedTypes,
                    },
                );

                const index = server.chatChannels.indexOf(channel);
                const channelButton = getComponent(keys.commands.chatchannel.success.channel_button, {
                    index1: index + 1,
                    index: index,
                });

                pages[channelButton.data.custom_id] = {
                    page: { embeds: [channelEmbed] },
                    button: channelButton,
                };
            }

            const pagination = new Pagination(client, interaction, pages);
            return pagination.start();
        }
    }
}
