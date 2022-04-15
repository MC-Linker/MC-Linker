const fs =  require('fs');
const plugin = require('../../api/plugin');
const utils = require("../../api/utils");
const { keys } = require('../../api/messages');

async function execute(message, args) {
    const method = args[0];

    if(!method) {
        message.respond(keys.commands.disconnect.warnings.no_method);
        return;
    }

    let path;
    if(method === 'ftp' || method === 'plugin') path = `./serverdata/connections/${message.guild.id}/`;
    else if(method === 'account') path = `./userdata/connections/${message.member.user.id}/`;
    else {
        message.respond(keys.commands.disconnect.warnings.invalid_method);
        return;
    }

    if(method === 'plugin' || method === 'ftp') {
        const protocol = await utils.getProtocol(message.guildId, message);
        if(!protocol) return;

        if(protocol !== method) {
            message.respond(keys.commands.disconnect.warnings.invalid_protocol, { method });
            return;
        }
    }

    if(method === 'plugin') {
        const disconnect = await plugin.disconnect(message.guildId, message);
        if(!disconnect) return;
    }

    fs.rm(path, { recursive: true, force: true }, err => {
        if(err) {
            message.respond(keys.commands.disconnect.errors.could_not_remove_folder);
            return;
        }

        message.respond(keys.commands.disconnect.success, { method, "method_cap": method.cap() });
    });
}

module.exports = { execute };