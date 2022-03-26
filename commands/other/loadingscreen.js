const Canvas = require('canvas');
const probe = require('probe-image-size');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	name: 'loadingscreen',
	aliases: ['load', 'loadscreen'],
	usage: 'loadingscreen <attachment/imageLink/@mention>',
    example: '/loadingscreen @Lianecx',
	description: 'Convert an attachment, image-link or @mention to a minecraft loading-screen.',
	data: new SlashCommandBuilder()
			.setName('loadingscreen')
			.setDescription('Convert an image-link to a minecraft loading-screen.')
			.addStringOption(option =>
				option.setName('url')
				.setDescription('Set the URL of the image you want to convert.')
				.setRequired(true)
			),
	async execute (message, args) {
		//get URL of image
		let URL;
		if (message.attachments.size) URL = message.attachments.first().url;
		else if (message.mentions.users.size) URL = message.mentions.users.first().displayAvatarURL({ format: 'png' });
		else if (args[0]) URL = args[0];
		else {
			console.log(`${message.member.user.tag} executed /loadingscreen without url or attach in ${message.guild.name}`);
			message.reply(':warning: Please attach an image, specify an image url or ping someone.');
			return;
		}

		console.log(`${message.member.user.tag} executed /loadingscreen with imgURL: ${URL} in ${message.guild.name}`);

		//get imageSize
		let imgSize;
		try {
			imgSize = await probe(URL);
		} catch (err) {
			console.log('Couldn\'t get image size. ', err);
			message.reply('<:Error:849215023264169985> Cannot get size of image. `/help loadingscreen` for correct usage.');
			return;
		}

		if(imgSize.type !== 'png' && imgSize.type !== 'jpg') {
			console.log(`Invalid image type: ${imgSize.type}`);
			message.reply(`<:Error:849215023264169985> Invalid image type [**${imgSize.type}**]. Supported types: **jpg, png**`);
			return;
		}

		const loadCanvas = Canvas.createCanvas(imgSize.height * 2, imgSize.height * 2);
		const context = loadCanvas.getContext('2d');
		let img;
		try {
			img = await Canvas.loadImage(URL);
		} catch(err) {
			console.log('Error trying to load img. ', err);
			message.reply('<:Error:849215023264169985> Cannot load image. `/help loadingscreen` for correct usage.');
			return;
		}

		//draw half of image top right
		context.drawImage(img, 0, 0, imgSize.width/2, imgSize.height, loadCanvas.width-(imgSize.width/2), 0, imgSize.width/2, imgSize.height);

		//draw 2nd half bottom left
		context.drawImage(img, imgSize.width/2, 0, imgSize.width/2, imgSize.height, 0, imgSize.height, imgSize.width/2, imgSize.height);

		const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojangstudios.png');
		const loadEmbed = new Discord.MessageEmbed()
			.setTitle("Minecraft Loading Screen")
			.setDescription('<:Checkmark:849224496232660992> Here\'s your Minecraft loading screen! Make sure to put it in: `<resourcepack>/assets/minecraft/textures/gui/title/`')
			.setImage('attachment://mojangstudios.png');
		message.reply({ embeds: [loadEmbed], files: [attachment] });
	}
}
