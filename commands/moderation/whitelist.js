const { keys } = require('../../api/messages');
const Discord = require("discord.js");
const utils = require("../../api/utils");
const plugin = require("../../api/plugin");

async function execute(message, args) {
    let method = args[0];

    if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.whitelist.warnings.no_permission);
        return;
    }

    if(method === 'add' || method === 'remove') {
        const user = message.mentions.users.first() ?? args[1];

        if(!user) {
            message.respond(keys.commands.whitelist.warnings.no_username);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, message) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`whitelist ${method} ${mcUsername}`, message);
        if(!resp) return;

        if(method === 'add') {
            if(resp.status === 206) message.respond(keys.commands.whitelist.warnings.add_warning, { username: user, "response": resp.message });
            else message.respond(keys.commands.whitelist.success.add, { username: user });
        } else {
            if(resp.status === 206) message.respond(keys.commands.whitelist.warnings.remove_warning, { username: user, "response": resp.message });
            else message.respond(keys.commands.whitelist.success.remove, { username: user });
        }

    } else if(method === 'enable' || method === 'disable') {
        const minecraftSubcommand = method === 'enable' ? 'on' : 'off';

        const resp = await plugin.execute(`whitelist ${minecraftSubcommand}`, message);
        if(!resp) return;

        if(method === 'enable') {
            if(resp.status === 206) message.respond(keys.commands.whitelist.warnings.enable_warning, { "response": resp.message });
            else message.respond(keys.commands.whitelist.success.enable);
        } else {
            if(resp.status === 206) message.respond(keys.commands.whitelist.warnings.disable_warning, { "response": resp.message });
            else message.respond(keys.commands.whitelist.success.disable);
        }
    }
}

module.exports = { execute };

