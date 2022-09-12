const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function execute(message, args) {
    const user = message.mentions.users.first() ?? args[0];

    if(!message.member.permissions.has(Discord.PermissionFlagsBits.BanMembers)) {
        message.replyTl(keys.commands.unban.warnings.no_permission);
        return;
    }
    else if(!user) {
        message.replyTl(keys.commands.unban.warnings.no_username);
        return;
    }

    const mcUsername = user.id ? await utils.getUsername(user.id, message) : user;
    if(!mcUsername) return;

    const resp = await plugin.execute(`pardon ${mcUsername}`, message.guildId, message);
    if(!resp) return;

    if(resp.status === 206) message.replyTl(keys.commands.unban.warnings.response_warning, { username: user });
    else message.replyTl(keys.commands.unban.success, { username: user });
}

module.exports = { execute };