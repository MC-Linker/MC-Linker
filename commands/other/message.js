const rcon = require('../../rcon.js');
const utils = require('../../utils.js');

module.exports = {
    name: 'message',
    aliases: ['dm', 'msg', 'tell', 'whisper', 'w'],
    example: '^message @Lianecx Hey, its me! **//** ^message someGuy §6Golden message',
    usage: 'message <@mention/ingamename> <message>',
    description: 'Send chat messages to people on the server. Color codes can be found [here](https://minecraft.fandom.com/wiki/Formatting_codes#Color_codes).',
    async execute(message, args) {
        let taggedName;
        let userName;

        if(!args[0]) {
            console.log(message.member.user.tag + ' executed ^message without user in ' + message.guild.name);
            message.reply(':warning: Please specify the user you want to message.');
            return;
        }

        let taggedUser = args.shift();
        if(!message.mentions.users.size) {
            userName = taggedUser;
            taggedName = taggedUser;
        } else {
            userName = await utils.getUserName(message.mentions.users.first().id, message);
            if(!userName) return;
            taggedName = message.mentions.users.first().tag;
        }

        const chatMsg = args.join(' ').replaceAll(`"`, `'`);
        if(!chatMsg) {
            console.log(message.member.user.tag + ' executed ^message without message in ' + message.guild.name);
            message.reply(':warning: Please specify the message you want to send.');
            return;
        }

        console.log(message.member.user.tag + ' executed ^message ' + taggedName + ' ' + chatMsg + ' in ' + message.guild.name);

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

        const response = await rcon.executeGetCredentials(`tellraw ${userName} ["",{"text":"Discord","bold":true,"italic":true,"color":"blue","clickEvent":{"action":"open_url","value":"https://top.gg/bot/712759741528408064"},"hoverEvent":{"action":"show_text","contents":["Message sent using ",{"text":"SMP-Bot","color":"gold"}]}},{"text":" | ${message.member.user.tag} whispers to you: ${chatMsg}","italic":true}]`, message);
        if(!response) {
            message.reply(`<:Checkmark:849224496232660992> Sent Message to ${taggedName}:\n**${chatMsg}**`);
        } else {
            console.log(response);
            message.reply('<:Error:849215023264169985> Error:\n' + response);
        }
	}
}