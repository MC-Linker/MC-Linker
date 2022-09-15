const Discord = require('discord.js');
const fs = require('fs-extra');
const { keys, addResponseMethods, getEmbed, ph, getComponent, createActionRows } = require('../../api/messages');
const Command = require('../../structures/Command');

class Chatchannel extends Command {

    constructor() {
        super('chatchannel');
    }

    async execute(interaction, client, args) {
        const method = args[0];

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            interaction.replyTl(keys.commands.chatchannel.warnings.no_permission);
            return;
        }
        else if(!method) {
            interaction.replyTl(keys.commands.chatchannel.warnings.no_method);
            return;
        }

        //Add chatchannel
        if(method === 'add') {
            let channel = interaction.mentions.channels?.first() ?? args[1];
            const useWebhooks = typeof args[2] === 'boolean' ? args[2] : args[2]?.toLowerCase() === 'true';

            if(!channel) {
                interaction.replyTl(keys.commands.chatchannel.warnings.no_channel);
                return;
            }
            else if(!channel.isTextBased()) {
                interaction.replyTl(keys.commands.chatchannel.warnings.no_text_channel);
                return;
            }

            const logChooserMsg = await interaction.replyTl(keys.commands.chatchannel.success.choose);

            const collector = logChooserMsg.createMessageComponentCollector({
                componentType: Discord.ComponentType.SelectMenu,
                time: 30_000,
                max: 1,
            });
            collector.on('collect', async menu => {
                if(menu.customId !== 'log') return;

                menu = addResponseMethods(menu);

                if(menu.user.id !== interaction.member.user.id) {
                    const notAuthorEmbed = getEmbed(keys.commands.chatchannel.warnings.not_author_select, ph.emojis());
                    menu.replyOptions({ embeds: [notAuthorEmbed], ephemeral: true });
                    return;
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

                const regChannel = await plugin.registerChannel(interaction.guildId, channel.id, menu.values, webhook?.id, interaction.client, menu);
                if(!regChannel) {
                    webhook?.delete();
                    return;
                }

                const pluginJson = {
                    'ip': regChannel.ip,
                    'version': regChannel.version.split('.')[1],
                    'path': regChannel.path,
                    'hash': regChannel.hash,
                    'guild': regChannel.guild,
                    'online': regChannel.online,
                    'chat': true,
                    'channels': regChannel.channels,
                    'protocol': 'plugin',
                };

                fs.outputJson(`./serverdata/connections/${interaction.guild.id}/connection.json`, pluginJson, { spaces: 2 }, err => {
                    if(err) {
                        interaction.replyTl(keys.commands.chatchannel.errors.could_not_write_file);
                        return;
                    }

                    menu.replyTl(keys.commands.chatchannel.success.add, ph.std(interaction));
                });
            });
            collector.on('end', collected => {
                if(!collected.size) interaction.replyTl(keys.commands.chatchannel.warnings.not_collected);
                else interaction.replyTl(keys.commands.chatchannel.warnings.already_responded);
            });

        }
        //Remove chatchannel
        else if(method === 'remove') {
            let channel = interaction.mentions.channels?.first() ?? args[1];

            if(!channel) {
                interaction.replyTl(keys.commands.chatchannel.warnings.no_channel);
                return;
            }
            else if(!channel.isTextBased()) {
                interaction.replyTl(keys.commands.chatchannel.warnings.no_text_channel);
                return;
            }

            const ip = await utils.getIp(interaction.guild.id, interaction);
            if(!ip) return;

            const connection = await utils.getServerData(interaction.guild.id, interaction);
            if(!connection) return;
            const channelIndex = connection.channels?.findIndex(c => c.id === channel.id);

            if(channelIndex === undefined || channelIndex === -1) {
                interaction.replyTl(keys.commands.chatchannel.warnings.channel_not_added);
                return;
            }
            else {
                //Remove chatchannel from connection
                connection.channels.splice(channelIndex, 1);
            }

            const unregChannel = await plugin.unregisterChannel(ip, interaction.guildId, channel.id, interaction.client, interaction);
            if(!unregChannel) return;

            fs.outputJson(`./serverdata/connections/${interaction.guild.id}/connection.json`, connection, { spaces: 2 }, err => {
                if(err) {
                    interaction.replyTl(keys.commands.chatchannel.errors.could_not_write_file);
                    return;
                }

                interaction.replyTl(keys.commands.chatchannel.success.remove);
            });
        }
        else if(method === 'list') {
            const connection = await utils.getServerData(interaction.guild.id, interaction);
            if(!connection) return;

            if(!connection.channels) {
                interaction.replyTl(keys.commands.chatchannel.warnings.no_channels);
                return;
            }

            const listEmbeds = [];
            let channelButtons = [];

            for(const channel of connection.channels) {
                const formattedTypes = channel.types.map(type => {
                    const options = keys.commands.chatchannel.success.choose.components[0].options;
                    return options.find(o => o.value === type).label;
                }).join(',\n');


                const channelEmbed = getEmbed(
                    keys.commands.chatchannel.success.list,
                    ph.std(interaction),
                    {
                        channel: interaction.client.channels.cache.get(channel.id),
                        webhooks: channel.webhook ? keys.commands.chatchannel.success.enabled : keys.commands.chatchannel.success.disabled,
                        'channel_types': formattedTypes,
                    },
                );

                const index = connection.channels.indexOf(channel);
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
                    button.reply({ embeds: [notAuthorEmbed], ephemeral: true });
                    return;
                }

                const index = parseInt(button.customId.split('_').pop());
                await button.update({ embeds: [listEmbeds[index]], components: channelButtons });
            });
        }
        else {
            interaction.replyTl(keys.commands.chatchannel.warnings.invalid_method);
        }
    }
}

module.exports = Chatchannel;
