const Discord = require('discord.js');
const { keys, addResponseMethods, getEmbed, ph, getComponent, createActionRows } = require('../../api/messages');
const Command = require('../../structures/Command');

class Chatchannel extends Command {

    constructor() {
        super({
            name: 'chatchannel',
            requiresConnectedPlugin: true,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const method = args[0];

        //Add chatchannel
        if(method === 'add') {
            let channel = args[1];
            const useWebhooks = args[2];

            if(!channel.isTextBased()) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.no_text_channel);
            }

            const logChooserMsg = await interaction.replyTl(keys.commands.chatchannel.success.choose);

            //TODO change to awaitMessageComponent
            const collector = logChooserMsg.createMessageComponentCollector({
                componentType: Discord.ComponentType.SelectMenu,
                time: 30_000,
                max: 1,
            });
            collector.on('collect', async menu => {
                if(menu.customId !== 'log') return;

                menu = addResponseMethods(menu);

                if(menu.user.id !== interaction.user.id) {
                    const notAuthorEmbed = getEmbed(keys.commands.chatchannel.warnings.not_author_select, ph.emojis());
                    return menu.replyOptions({ embeds: [notAuthorEmbed], ephemeral: true });
                }

                //Create webhook for channel
                let webhook;
                if(useWebhooks && menu.values.includes('chat')) {
                    if(channel.isThread()) webhook = await channel.parent.createWebhook({
                        name: 'ChatChannel',
                        reason: 'ChatChannel to Minecraft',
                    });
                    else webhook = await channel.createWebhook({
                        name: 'ChatChannel',
                        reason: 'ChatChannel to Minecraft',
                    });
                }

                const resp = await server.protocol.addChatChannel({
                    id: channel.id,
                    webhook: webhook?.id,
                    types: menu.values,
                });
                if(!resp) {
                    webhook?.delete();
                    return interaction.replyTl(keys.api.plugin.errors.no_response);
                }

                await server.edit({
                    chat: true,
                    channels: resp.data.channels,
                });

                return interaction.replyTl(keys.commands.chatchannel.success.add);
            });
            collector.on('end', collected => {
                if(!collected.size) interaction.replyTl(keys.commands.chatchannel.warnings.not_collected);
                else interaction.replyTl(keys.commands.chatchannel.warnings.already_responded);
            });

        }
        //Remove chatchannel
        else if(method === 'remove') {
            let channel = args[1];

            if(!channel.isTextBased()) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.no_text_channel);
            }

            const channelIndex = server.channels.findIndex(c => c.id === channel.id);
            if(channelIndex === -1) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.channel_not_added);
            }

            const resp = await server.protocol.removeChatChannel(server.channels[channelIndex]);
            if(!resp) {
                return interaction.replyTl(keys.api.plugin.errors.no_response);
            }

            await server.edit({
                chat: resp.data.chat,
                channels: resp.data.channels,
            });

            return interaction.replyTl(keys.commands.chatchannel.success.remove);
        }
        else if(method === 'list') {
            if(!server.channels.length) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.no_channels);
            }

            const listEmbeds = [];
            let channelButtons = [];

            for(const channel of server.channels) {
                const formattedTypes = channel.types.map(type => {
                    const options = keys.commands.chatchannel.success.choose.components[0].options;
                    return options.find(o => o.value === type).label;
                }).join(',\n');


                const channelEmbed = getEmbed(
                    keys.commands.chatchannel.success.list,
                    ph.std(interaction),
                    {
                        channel: await interaction.guild.channels.fetch(channel.id),
                        webhooks: channel.webhook ? keys.commands.chatchannel.success.enabled : keys.commands.chatchannel.success.disabled,
                        channel_types: formattedTypes,
                    },
                );

                const index = server.channels.indexOf(channel);
                const channelButton = getComponent(keys.commands.chatchannel.success.channel_button, {
                    index1: index + 1,
                    index: index,
                });

                listEmbeds.push(channelEmbed);
                channelButtons.push(channelButton);
            }
            channelButtons = createActionRows(channelButtons);

            const listMessage = await interaction.replyOptions({ embeds: [listEmbeds[0]], components: channelButtons });

            const collector = listMessage.createMessageComponentCollector({
                componentType: Discord.ComponentType.Button,
                time: 120_000,
            });
            collector.on('collect', async button => {
                if(!button.customId.startsWith('channel')) return;

                if(button.user.id !== interaction.member.user.id) {
                    const notAuthorEmbed = getEmbed(keys.commands.chatchannel.warnings.not_author_button, ph.emojis());
                    return button.reply({ embeds: [notAuthorEmbed], ephemeral: true });
                }

                const index = parseInt(button.customId.split('_').pop());
                await button.update({ embeds: [listEmbeds[index]], components: channelButtons });
            });
        }
    }
}

module.exports = Chatchannel;
