const fs =  require('fs');
const plugin = require('../../api/plugin');
const utils = require("../../api/utils");

async function execute(message, args) {
    const method = args[0];

    if(!method) {
        console.log(`${message.member.user.tag} executed /disconnect without method in ${message.guild.name}`);
        message.reply(':warning: Please set the connection method (`ftp`, `plugin`, `user`).');
        return;
    }
    let path;
    if(method === 'ftp' || method === 'plugin') path = `./serverdata/connections/${message.guild.id}/`;
    else if(method === 'account') path = `./userdata/connections/${message.member.user.id}/`;
    else {
        console.log(`${message.member.user.tag} executed /disconnect with wrong method in ${message.guild.name}`);
        message.reply(':warning: You can only disconnect from `ftp`, `plugin` or `account`.');
        return;
    }

    console.log(`${message.member.user.tag} executed /disconnect ${method} in ${message.guild.name}`);


    if(method === 'plugin' || method === 'ftp') {
        const protocol = await utils.getProtocol(message.guildId, message);
        if(!protocol) return;

        if(protocol !== method) {
            console.log(`Wrong protocol ${protocol}`);
            message.reply(`:warning: Couldn't disconnect from the **${method}** connection because you are **not connected**.`);
            return;
        }
    }

    if(method === 'plugin') {
        const disconnect = await plugin.disconnect(message.guildId, message);
        if(!disconnect) return;
    }

    fs.rm(path, { recursive: true, force: true }, err => {
        if(err) {
            console.log(`Error trying to delete ${method} connection folder.`, err);
            message.reply(`:warning: Couldn't disconnect from the **${method}** connection because you are **not connected**.`);
            return;
        }
        console.log(`The ${method} connection to this bot was successfully disconnected.`);
        message.reply(`<:Checkmark:849224496232660992> The **${method}** connection to this bot was successfully disconnected.`);
    });
}

module.exports = { execute };