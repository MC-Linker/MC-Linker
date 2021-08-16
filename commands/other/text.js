const Canvas = require('canvas');
const Discord = require('discord.js');

module.exports = {
    name: 'text',
    aliases: ['texts', 'font', 'fonts'],
    usage: 'text mojang/minecraft/<Any Preinstalled Font (`Space` **=** `_`)> <color> <Your text>',
    example: 'text minecraft red I love this bot!',
    description: 'Create images with text with different fonts and colors. All color ids can be found [here.](https://developer.mozilla.org/de/docs/Web/CSS/color_value#farbschlüsselwörter)\n**Special fonts**: `varela_round`, `minecrafter`, `mojang`, `minecraft`',
    execute(message, args) {
        let font = args.shift().split('_').join(' ');
        const color = args.shift().toLowerCase();
        const text = args.join(' ');

        if (!font) {
            console.log(message.member.user.tag + ' executed ^text without args in ' + message.guild.name);
            message.reply(':warning: Do you want to create a Mojang studios font: `^text mojang`, minecraft font: `^text minecraft` or an image with a different font: `^font <Any Preinstalled Font>');
            return;
        } else if (!color) {
            console.log(message.member.user.tag + ' executed ^text without color and text in ' + message.guild.name);
            message.reply(':warning: Please to specify a color and a text.');
            return;
        } else if (!text) {
            console.log(message.member.user.tag + ' executed ^text without text in ' + message.guild.name);
            message.reply(':warning: Please specify the text you want to create the image with.');
            return;
        }

        console.log(message.member.user.tag + ' executed ^text ' + font + ' ' + color + ' ' + text + ' in ' + message.guild.name);

        if (font === 'mojang' || font === 'mojangstudios' || font === 'mojang-studios') font = 'mojangstudiosfont by bapakuy';

        const fontCanvas = Canvas.createCanvas(text.split('').length * 100, 225);
        const ctx = fontCanvas.getContext('2d');
        try {
            ctx.font = `200px ${font}`;
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.fillText(text, 0, 200, fontCanvas.width);
        } catch (err) {
            console.log('Error trying to apply text.', err);
            message.reply('<:Error:849215023264169985> Please check if you entered a valid font or color.');
            return;
        }

        const fontImg = new Discord.MessageAttachment(fontCanvas.toBuffer(), 'textImage.png');
        message.reply({ content: '<:Checkmark:849224496232660992> Heres your custom text-image.', files: [fontImg] });
    }
}