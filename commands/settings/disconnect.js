const fs = require('fs-extra');
const plugin = require('../../api/plugin');
const utils = require('../../api/utils');
const { keys } = require('../../api/messages');
const Discord = require('discord.js');

async function execute(message, args) {
    const method = args[0];

    if(!method) {
        message.replyTl(keys.commands.disconnect.warnings.no_method);
        return;
    }

    let path;
    if(method === 'ftp' || method === 'plugin') path = `./serverdata/connections/${message.guild.id}/`;
    else if(method === 'account') path = `./userdata/connections/${message.member.user.id}/`;
    else {
        message.replyTl(keys.commands.disconnect.warnings.invalid_method);
        return;
    }

    if(method === 'plugin' || method === 'ftp') {
        if(!message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            message.replyTl(keys.commands.disconnect.warnings.no_permission);
            return;
        }

        const protocol = await utils.getProtocol(message.guildId, message);
        if(!protocol) return;

        if(protocol !== method) {
            message.replyTl(keys.commands.disconnect.warnings.invalid_protocol, { method });
            return;
        }
    }

    if(method === 'plugin') {
        const disconnect = await plugin.disconnect(message.guildId, message.client, message);
        if(!disconnect) return;
    }

    fs.remove(path, err => {
        if(err) {
            message.replyTl(keys.commands.disconnect.errors.could_not_remove_folder);
            return;
        }

        message.replyTl(keys.commands.disconnect.success, { method, 'method_cap': method.cap() });
    });
}

module.exports = { execute };