const Discord = require('discord.js');
const fs = require('fs-extra');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const { keys, getEmbedBuilder, ph } = require('../../api/messages');

async function execute(message, args) {
    const method = args[0];
    let channel = message.mentions.channels?.first() ?? args[1];
    const useWebhooks = typeof args[2] === 'boolean' ? args[2] : args[2]?.toLowerCase() === 'true';

    if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.chatchannel.warnings.no_permission);
        return;
    } else if(!method) {
        message.respond(keys.commands.chatchannel.warnings.no_method);
        return;
    } else if(!channel) {
        message.respond(keys.commands.chatchannel.warnings.no_channel);
        return;
    } else if(!channel?.isText()) {
        message.respond(keys.commands.chatchannel.warnings.no_text_channel);
        return;
    }

    //Add chatchannel
    if(method === 'add') {
        const logChooserMsg = await message.respond(keys.commands.chatchannel.success.choose);

        const collector = logChooserMsg.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 20000, max: 1 });
        collector.on('collect', async menu => {
            if(menu.customId === 'log' && menu.member.user.id === message.member.user.id) {
                const ip = await utils.getIp(message.guild.id, message);
                if(!ip) return;

                //Create webhook for channel
                let webhook;
                if(useWebhooks && menu.values.includes('chat')) {
                    if(channel.isThread()) webhook = await channel.parent.createWebhook("ChatChannel", { reason: "ChatChannel to Minecraft" });
                    else webhook = await channel.createWebhook("ChatChannel", { reason: "ChatChannel to Minecraft" });
                }

                const regChannel = await plugin.registerChannel(ip, message.guildId, channel.id, menu.values, webhook?.id, menu);
                if(!regChannel) {
                    webhook?.delete();
                    return;
                }

                const pluginJson = {
                    "ip": regChannel.ip,
                    "version": regChannel.version.split('.')[1],
                    "path": regChannel.path,
                    "hash": regChannel.hash,
                    "guild": regChannel.guild,
                    "chat": true,
                    "channels": regChannel.channels,
                    "protocol": "plugin"
                };

                fs.outputJson(`./serverdata/connections/${message.guild.id}/connection.json`, pluginJson, { spaces: 2 }, err => {
                    if(err) {
                        message.respond(keys.commands.chatchannel.errors.could_not_write_file);
                        return;
                    }

                    console.log(keys.commands.chatchannel.success.add.console);
                    const successEmbed = getEmbedBuilder(keys.commands.chatchannel.success.add, ph.fromStd(message));
                    menu.reply({ embeds: [successEmbed] });
                });
            } else {
                const notAuthorEmbed = getEmbedBuilder(keys.commands.chatchannel.warnings.not_author, ph.fromStd(message));
                menu.reply({ embeds: [notAuthorEmbed], ephemeral: true });
            }
        });
        collector.on('end', collected => {
            if(!collected.size) message.respond(keys.commands.chatchannel.warnings.not_collected);
            else message.respond(keys.commands.chatchannel.warnings.already_responded);
        });

    //Remove chatchannel
    } else if(method === 'remove') {
        const ip = await utils.getIp(message.guild.id, message);
        if(!ip) return;

        const connection = await utils.getServerData(message.guild.id, message);
        if(!connection) return;
        const channelIndex = connection.channels?.findIndex(c => c.id === channel.id);

        if(!channelIndex || channelIndex === -1) {
            message.respond(keys.commands.chatchannel.warnings.channel_not_added);
            return;
        } else {
            //Remove chatchannel from connection
            connection.channels.splice(channelIndex, 1);
        }

        const unregChannel = await plugin.unregisterChannel(ip, message.guildId, channel.id, message);
        if(!unregChannel) return;

        fs.outputJson(`./serverdata/connections/${message.guild.id}/connection.json`, connection, { spaces: 2 }, err => {
            if(err) {
                message.respond(keys.commands.chatchannel.errors.could_not_write_file);
                return;
            }

            message.respond(keys.commands.chatchannel.success.remove);
        });
    } else {
        message.respond(keys.commands.chatchannel.warnings.invalid_method);
    }
}

module.exports = { execute };