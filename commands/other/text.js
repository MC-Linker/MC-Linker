const Canvas = require('canvas');
const Discord = require('discord.js');
const { keys, getEmbedBuilder, ph } = require('../../api/messages');

async function execute(message, args) {
    let font = args.shift()?.replaceAll('_', '');
    const color = args.shift()?.toLowerCase();
    let text = args.join(' ');

    if (!font) {
        message.respond(keys.commands.text.warnings.no_font);
        return;
    } else if (!color) {
        message.respond(keys.commands.text.warnings.no_color);
        return;
    } else if (!text) {
        message.respond(keys.commands.text.warnings.no_text);
        return;
    }

    if (font === 'mojang' || font === 'mojangstudios' || font === 'mojang-studios') font = 'mojangstudiosfont by bapakuy';

    let canvasWidth = text.split('').length * 200;
    if(canvasWidth/200 >= 64) {
        canvasWidth = 64 * 200;
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
        message.respond(keys.commands.text.errors.could_not_apply_text);
        return;
    }

    const fontImg = new Discord.MessageAttachment(fontCanvas.toBuffer(), 'text_image.png');
    const textEmbed = getEmbedBuilder(keys.commands.text.success, ph.fromStd(message));
    message.replyOptions({ embeds: [textEmbed], files: [fontImg] });
}

module.exports = { execute };