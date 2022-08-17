const Discord = require('discord.js');
const fs = require('fs-extra');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const { keys, addResponseMethods, getEmbed, ph, getComponent, createActionRows } = require('../../api/messages');

async function execute(message, args) {
    const method = args[0];

    if(!message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
        message.respond(keys.commands.chatchannel.warnings.no_permission);
        return;
    }
    else if(!method) {
        message.respond(keys.commands.chatchannel.warnings.no_method);
        return;
    }

    //Add chatchannel
    if(method === 'add') {
        let channel = message.mentions.channels?.first() ?? args[1];
        const useWebhooks = typeof args[2] === 'boolean' ? args[2] : args[2]?.toLowerCase() === 'true';

        if(!channel) {
            message.respond(keys.commands.chatchannel.warnings.no_channel);
            return;
        }
        else if(!channel.isTextBased()) {
            message.respond(keys.commands.chatchannel.warnings.no_text_channel);
            return;
        }

        const logChooserMsg = await message.respond(keys.commands.chatchannel.success.choose);

        const collector = logChooserMsg.createMessageComponentCollector({
            componentType: Discord.ComponentType.SelectMenu,
            time: 30_000,
            max: 1,
        });
        collector.on('collect', async menu => {
            if(menu.customId !== 'log') return;

            menu = addResponseMethods(menu);

            if(menu.user.id !== message.member.user.id) {
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

            const regChannel = await plugin.registerChannel(message.guildId, channel.id, menu.values, webhook?.id, message.client, menu);
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

            fs.outputJson(`./serverdata/connections/${message.guild.id}/connection.json`, pluginJson, { spaces: 2 }, err => {
                if(err) {
                    message.respond(keys.commands.chatchannel.errors.could_not_write_file);
                    return;
                }

                menu.respond(keys.commands.chatchannel.success.add, ph.std(message));
            });
        });
        collector.on('end', collected => {
            if(!collected.size) message.respond(keys.commands.chatchannel.warnings.not_collected);
            else message.respond(keys.commands.chatchannel.warnings.already_responded);
        });

    }
    //Remove chatchannel
    else if(method === 'remove') {
        let channel = message.mentions.channels?.first() ?? args[1];

        if(!channel) {
            message.respond(keys.commands.chatchannel.warnings.no_channel);
            return;
        }
        else if(!channel.isTextBased()) {
            message.respond(keys.commands.chatchannel.warnings.no_text_channel);
            return;
        }

        const ip = await utils.getIp(message.guild.id, message);
        if(!ip) return;

        const connection = await utils.getServerData(message.guild.id, message);
        if(!connection) return;
        const channelIndex = connection.channels?.findIndex(c => c.id === channel.id);

        if(channelIndex === undefined || channelIndex === -1) {
            message.respond(keys.commands.chatchannel.warnings.channel_not_added);
            return;
        }
        else {
            //Remove chatchannel from connection
            connection.channels.splice(channelIndex, 1);
        }

        const unregChannel = await plugin.unregisterChannel(ip, message.guildId, channel.id, message.client, message);
        if(!unregChannel) return;

        fs.outputJson(`./serverdata/connections/${message.guild.id}/connection.json`, connection, { spaces: 2 }, err => {
            if(err) {
                message.respond(keys.commands.chatchannel.errors.could_not_write_file);
                return;
            }

            message.respond(keys.commands.chatchannel.success.remove);
        });
    }
    else if(method === 'list') {
        const connection = await utils.getServerData(message.guild.id, message);
        if(!connection) return;

        if(!connection.channels) {
            message.respond(keys.commands.chatchannel.warnings.no_channels);
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
                ph.std(message),
                {
                    channel: message.client.channels.cache.get(channel.id),
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

        const listMessage = await message.replyOptions({ embeds: [listEmbeds[0]], components: channelButtons });

        const collector = listMessage.createMessageComponentCollector({
            componentType: Discord.ComponentType.Button,
            time: 120_000,
        });
        collector.on('collect', async button => {
            if(!button.customId.startsWith('channel')) return;

            if(button.user.id !== message.member.user.id) {
                const notAuthorEmbed = getEmbed(keys.commands.chatchannel.warnings.not_author_button, ph.emojis());
                button.reply({ embeds: [notAuthorEmbed], ephemeral: true });
                return;
            }

            const index = parseInt(button.customId.split('_').pop());
            await button.update({ embeds: [listEmbeds[index]], components: channelButtons });
        });
    }
    else {
        message.respond(keys.commands.chatchannel.warnings.invalid_method);
    }
}

module.exports = { execute };