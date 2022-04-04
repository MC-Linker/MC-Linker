const Discord = require('discord.js');
const fs = require('fs');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const { keys, getEmbedBuilder, ph } = require('../../api/messages');

async function execute(message, args) {
    let channel = message.mentions.channels?.first() ?? args[0];

    if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.chatchannel.warnings.no_permission);
        return;
    } else if(!channel) {
        message.respond(keys.commands.chatchannel.warnings.no_channel);
        return;
    } else if(!channel.isText()) {
        message.respond(keys.commands.chatchannel.warnings.no_text_channel);
        return;
    }

    const logChooserMsg = message.respond(keys.commands.chatchannel.success.choose);

    const collector = logChooserMsg.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 20000, max: 1 });
    collector.on('collect', async menu => {
        if(menu.customId === 'log' && menu.member.user.id === message.member.user.id) {
            const ip = await utils.getIp(message.guild.id, message);
            if(!ip) return;

            const regChannel = await plugin.registerChannel(ip, message.guildId, channel.id, menu.values, menu);
            if(!regChannel) return;

            const pluginJson = {
                "ip": regChannel.ip,
                "version": regChannel.version.split('.')[1],
                "path": regChannel.path,
                "hash": regChannel.hash,
                "guild": regChannel.guild,
                "chat": true,
                "types": regChannel.types,
                "channel": regChannel.channel,
                "protocol": "plugin"
            }

            fs.writeFile(`./serverdata/connections/${message.guild.id}/connection.json`, JSON.stringify(pluginJson, null, 2), 'utf-8', err => {
                if(err) {
                    message.respond(keys.commands.chatchannel.errors.could_not_write_file);
                    return;
                }

                console.log(keys.commands.chatchannel.success.final.console);

                const successEmbed = getEmbedBuilder(keys.commands.chatchannel.success.final, ph.fromStd(message));
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
}

module.exports = { execute };