const { keys, getUsersFromMention } = require('../../api/messages');
const Discord = require("discord.js");
const utils = require("../../api/utils");
const plugin = require("../../api/plugin");


async function autocomplete(interaction) {
    //TODO Add some super fancy autocomplete for command name + options
}


async function execute(message, args) {
    const command = args[0];
    let cmdArgs = args[1] ?? '';

    if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.command.warnings.no_permission);
        return;
    } else if(!command) {
        message.respond(keys.commands.command.warnings.no_username);
        return;
    }

    //Replace pings with their username
    cmdArgs = cmdArgs.split(' ');
    for (let i = 0; i < cmdArgs.length; i++) {
        const arg = cmdArgs[i];

        const user = getUsersFromMention(message.client, arg)?.[0];
        if(!user) continue;

        const username = await utils.getUsername(user.id, message);
        if(!username) return;

        cmdArgs[i] = arg.replace(arg, username);
    }

    const resp = await plugin.execute(`${command} ${cmdArgs}`, message);
    if(!resp) return;

    if(resp.status === 206) message.respond(keys.commands.command.warnings.response_warning, { "response": resp.message });
    else message.respond(keys.commands.command.success, { "response": resp.message });
}

module.exports = { execute };

