const Canvas = require('canvas');
const probe = require('probe-image-size');
const Discord = require('discord.js');
const { keys, getEmbedBuilder, ph } = require('../../api/messages');

async function execute(message, args) {
	//get URL of image
	let url;
	if (message.attachments.size) url = message.attachments.first().url;
	else if (message.mentions.users.size) url = message.mentions.users.first().displayAvatarURL({ format: 'png' });
	else if (args[0]) url = args[0];
	else {
		message.respond(keys.commands.loadingscreen.warnings.no_image);
		return;
	}

	//get imageSize
	let imgSize;
	try {
		imgSize = await probe(url);
	} catch (err) {
		message.respond(keys.commands.loadingscreen.errors.could_not_get_size);
		return;
	}

	if(imgSize.type !== 'png' && imgSize.type !== 'jpg') {
		message.respond(keys.commands.loadingscreen.warnings.invalid_format, { "image_format": imgSize.type });
		return;
	}

	const loadCanvas = Canvas.createCanvas(imgSize.height * 2, imgSize.height * 2);
	const context = loadCanvas.getContext('2d');
	let img;
	try {
		img = await Canvas.loadImage(url);
	} catch(err) {
		message.respond(keys.commands.loadingscreen.errors.could_not_load);
		return;
	}

	//draw half of image top right
	context.drawImage(img, 0, 0, imgSize.width/2, imgSize.height, loadCanvas.width-imgSize.width/2, 0, imgSize.width/2, imgSize.height);

	//draw 2nd half bottom left
	context.drawImage(img, imgSize.width/2, 0, imgSize.width/2, imgSize.height, 0, imgSize.height, imgSize.width/2, imgSize.height);

	const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojangstudios.png');
	const loadEmbed = getEmbedBuilder(keys.commands.loadingscreen.success, ph.fromStd(message));
	message.replyOptions({ embeds: [loadEmbed], files: [attachment] });
}

module.exports = { execute };
