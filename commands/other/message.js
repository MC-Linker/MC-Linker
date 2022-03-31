const plugin = require('../../api/plugin');
const utils = require('../../api/utils');

async function execute(message, args) {
    const username = message.mentions.users.first()?.tag ?? args[0];
    args.shift();
    const chatMsg = args?.join(' ').replaceAll(`"`, `\\"`);

    if(!username) {
        console.log(`${message.member.user.tag} executed /message without user in ${message.guild.name}`);
        message.reply(':warning: Please specify the user you want to message.');
        return;
    } else if(!chatMsg) {
        console.log(`${message.member.user.tag} executed /message without message in ${message.guild.name}`);
        message.reply(':warning: Please specify the message you want to send.');
        return;
    }

    console.log(`${message.member.user.tag} executed /message ${username} ${chatMsg} in ${message.guild.name}`);

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
                        "color":"gold"
                    }
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

    if(resp.startsWith('&c')) message.reply(`Warning trying to send message [**${username}**]: ${resp.replace('&c', '')}`);
    else if(resp.startsWith('Could not fetch response message!')) message.reply(`:warning: Successfully sent message to ${username}\n${resp}`);
    else message.reply(`<:Checkmark:849224496232660992> Successfully sent Message to ${username}:\n**${chatMsg}**`);
}

module.exports = { execute };