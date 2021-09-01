const rcon = require('../../rcon.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'chat',
    aliases: [''],
    usage: 'chat <message>',
    example: '^chat Hey, Minecraft! **//** ^chat §6Golden Message',
    description: 'Send chat messages to the server. Color codes can be found [here](https://minecraft.fandom.com/wiki/Formatting_codes#Color_codes).',
    data: new SlashCommandBuilder()
            .setName('chat')
            .setDescription('Send chat messages to the server.')
            .addStringOption(option =>
                option.setName('message')
                .setDescription('Set the message you want to send.')
                .setRequired(true)
            ),
    async execute(message, args) {
        const chatMsg = args.join(' ').replaceAll(`"`, `'`);
        console.log(message.member.user.tag + ' executed ^chat ' + chatMsg + ' in ' + message.guild.name);

        if(!chatMsg) {
            console.log(message.member.user.tag + ' executed ^chat without message in ' + message.guild.name);
            message.reply(':warning: Please specify the message you want to send.');
            return;
        }

        /*[
            "",
            {
                "text":"Discord",
                "bold":true,
                "color":"aqua",
                "clickEvent": {
                    "action":"open_url",
                    "value":"https://top.gg/bot/712759741528408064"
                },
                "hoverEvent": {
                    "action":"show_text",
                    "contents":
                    ["Message sent using \u00A76SMP-Bot"]
                }
            },
            {
                "text":" | ${message.member.user.tag} "
                ,"bold":true
            },
            {
                "text":">>",
                "color":"dark_gray"
            },
            " ${chatMsg}"
        ]*/
        const response = await rcon.executeGetCredentials(`tellraw @a ["",{"text":"Discord","bold":true,"color":"blue","clickEvent":{"action":"open_url","value":"https://top.gg/bot/712759741528408064"},"hoverEvent":{"action":"show_text","contents":["Message sent using \u00A76SMP-Bot"]}},{"text":" | ${message.member.user.tag} ","bold":true},{"text":">>","color":"dark_gray"}," ${chatMsg}"]`, message)
        if(!response) {
            message.reply("<:Checkmark:849224496232660992> Sent Message to Minecraft:**\n" + chatMsg + "**");
        } else {
            message.reply('<:Error:849215023264169985> Error:\n' + response);
        }
	}
}