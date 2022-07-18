const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function execute(message, args) {
    const user = message.mentions.users.first() ?? args[0];
    const gamemode = args[1];

    if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.gamemode.warnings.no_permission);
        return;
    } else if(!user) {
        message.respond(keys.commands.gamemode.warnings.no_username);
        return;
    } else if(!gamemode) {
        message.respond(keys.commands.gamemode.warnings.no_gamemode);
        return;
    }

    const mcUsername = user.id ? await utils.getUsername(user.id, message) : user;
    if(!mcUsername) return;

    const resp = await plugin.execute(`gamemode ${gamemode} ${mcUsername}`, message.guildId, message);
    if(!resp) return;

    if(resp.status === 206) message.respond(keys.commands.gamemode.warnings.response_warning, { username: user, gamemode: gamemode.cap() });
    else message.respond(keys.commands.gamemode.success, { username: user, gamemode: gamemode.cap() });
}

module.exports = { execute };