const plugin = require('../../api/plugin');
const utils = require('../../api/utils');
const { keys } = require('../../api/messages');

async function execute(message, args) {
    const username = message.mentions.users.first() ?? args[0];
    args.shift(); //Remove username from args
    const chatMsg = args?.join(' ').replaceAll(`"`, `\\"`);
    const argPlaceholder = { username, "message": chatMsg };

    if(!username) {
        message.respond(keys.commands.message.warnings.no_username);
        return;
    } else if(!chatMsg) {
        message.respond(keys.commands.message.warnings.no_message);
        return;
    }

    const mcUsername = username.id ? await utils.getUsername(username.id, message) : username;
    if(!mcUsername) return;

    const resp = await plugin.chatPrivate(chatMsg, message.member.user.tag, mcUsername, message);
    if(!resp) return;

    if(resp.status === 206) message.respond(keys.commands.message.warnings.response_warning, argPlaceholder, { "response": resp.message });
    else message.respond(keys.commands.message.success, argPlaceholder);
}

module.exports = { execute };