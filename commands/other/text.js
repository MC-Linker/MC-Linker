const Canvas = require('canvas');
const Discord = require('discord.js');

async function execute(message, args) {
    let font = args.shift()?.replaceAll('_', '');
    const color = args.shift()?.toLowerCase();
    let text = args.join(' ');

    if (!font) {
        console.log(`${message.member.user.tag} executed /text without args in ${message.guild.name}`);
        message.reply(':warning: Do you want to create a Mojang studios font: `/text mojang`, minecraft font: `/text minecraft` or an image with a different font: `/text <Any Preinstalled Font>');
        return;
    } else if (!color) {
        console.log(`${message.member.user.tag} executed /text without color and text in ${message.guild.name}`);
        message.reply(':warning: Please specify a color. All color ids can be found here:\nhttps://developer.mozilla.org/en-US/docs/Web/CSS/color_value#color_keywords');
        return;
    } else if (!text) {
        console.log(`${message.member.user.tag} executed /text without text in ${message.guild.name}`);
        message.reply(':warning: Please specify a text.');
        return;
    }

    console.log(`${message.member.user.tag} executed /text ${font} ${color} ${text} in ${message.guild.name}`);

    if (font === 'mojang' || font === 'mojangstudios' || font === 'mojang-studios') font = 'mojangstudiosfont by bapakuy';

    let canvasWidth = (text.split('').length)*200;
    if((canvasWidth/200)>=64) {
        canvasWidth = 64*200;
        text = text.substring(0, 64);
    }

    const fontCanvas = Canvas.createCanvas(canvasWidth, 225);
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

    const fontImg = new Discord.MessageAttachment(fontCanvas.toBuffer(), 'text_image.png');
    const textEmbed = new Discord.MessageEmbed()
        .setTitle("Custom Text Image")
        .setDescription('<:Checkmark:849224496232660992> Here\'s your custom text image.')
        .setImage('attachment://Text_Image.png');
    message.reply({ embeds: [textEmbed], files: [fontImg] });
}

module.exports = { execute };