const plugin = require('../../api/plugin');
const utils = require('../../api/utils');
const { keys } = require('../../api/messages');

async function execute(message, args) {
    const username = message.mentions.users.first()?.tag ?? args[0];
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

    const mcUsername = await utils.getUsername(message.mentions.users.first().id, message);
    if(!mcUsername) return;

    /*[
        "",
        {
            "text":"Discord",
            "bold":true,
            "italic":true,
            "color":"blue",
            "clickEvent": {
                "action":"open_url",
                "value":"https://top.gg/bot/712759741528408064"
            },
            "hoverEvent": {
                "action":"show_text",
                "contents": [
                    "Message sent using ",
                    {
                        "text":"SMP-Bot",
                        "color":"gold"1
                ]
            }
        },
        {
            "text":" | ${message.member.user.tag} whispers to you: ${chatMsg}",
            "italic":true
        }
    ]*/

    const resp = await plugin.execute(`tellraw ${mcUsername} ["",{"text":"Discord","bold":true,"italic":true,"color":"blue","clickEvent":{"action":"open_url","value":"https://top.gg/bot/712759741528408064"},"hoverEvent":{"action":"show_text","contents":["Message sent using ",{"text":"Minecraft SMP-Bot","color":"gold"}]}},{"text":" | ${message.member.user.tag} whispers to you: ${chatMsg}","italic":true}]`, message);
    if(!resp) return;

    if(resp.startsWith('&c')) message.respond(keys.commands.message.warnings.response_warning, argPlaceholder, { "response": resp });
    else if(resp.startsWith('Could not fetch response message!')) message.respond(keys.commands.message.warnings.no_response, argPlaceholder);
    else message.respond(keys.commands.message.success, argPlaceholder);
}

module.exports = { execute };