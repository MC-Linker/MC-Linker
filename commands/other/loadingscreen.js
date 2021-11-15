const Canvas = require('canvas');
const probe = require('probe-image-size');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	name: 'loadingscreen',
	aliases: ['load', 'loadscreen'],
	usage: 'loadingscreen <attachment/imageLink/@mention>',
    example: '/loadingscreen @Lianecx',
	description: 'Tools for minecraft texturepacks. \n`txp load` => Outputs a loading screen from the given attachment, image-link or @mention.',
	data: new SlashCommandBuilder()
			.setName('loadingscreen')
			.setDescription('Tools for minecraft texturepacks.'),
	async execute (message, args) {
		await message.deferReply();
		//get URL of image
		let URL;
		if (message.attachments.size) {
			try {
				URL = message.attachments.first().url;
			} catch (err) {
				console.log(message.member.user.tag + ' executed /loadingscreen. Couldnt get image url in ' + message.guild.name, err);
				message.reply('<:Error:849215023264169985> Cannot get URL of image. Please attach an image, specify an image url or @mention someone.');
				return;
			}
		} else if (message.mentions.users.size) {
			URL = message.mentions.users.first().displayAvatarURL({ dynamic: false, format: 'png' });
		} else if (args[1]) {
			URL = (args[1]);
		} else {
			console.log(message.member.user.tag + ' executed /loadingscreen without url or attach in ' + message.guild.name);
			message.reply(':warning: Please attach an image, specify an image url or @mention someone.');
			return;
		}

		console.log(`${message.member.user.tag} executed /loadingscreen with imgURL: ${URL} in ${message.guild.name}`);

		//get imageSize
		let imgSize;
		try {
			imgSize = await probe(URL);
		} catch (err) {
			console.log('Error while trying to get imagesize. ', err);
			message.reply('<:Error:849215023264169985> Cannot get size of image. `/help loadingscreen` for correct usage.');
			return;
		}

		if(imgSize.type !== 'png' && imgSize.type !== 'jpg') {
			console.log('Invalid imagetype: ' + imgSize.type);
			message.reply('<:Error:849215023264169985> Invalid image type [**' + imgSize.type + '**]. Supported types: **jpg, png**');
			return;
		}

		const loadCanvas = Canvas.createCanvas(imgSize.height * 2, imgSize.height * 2);
		const context = loadCanvas.getContext('2d');
		let img;
		try {
			img = await Canvas.loadImage(URL);
		} catch(err) {
			console.log('Error trying to load img. ', err);
			message.reply('<:Error:849215023264169985> Unsupported image type. `/help loadingscreen` for correct usage.');
			return;
		}

		//draw half of image top right
		context.drawImage(img, 0, 0, imgSize.width / 2, imgSize.height, loadCanvas.width - (imgSize.width / 2), 0, imgSize.width / 2, imgSize.height);

		//draw 2nd half bottom left
		context.drawImage(img, imgSize.width / 2, 0, imgSize.width / 2, imgSize.height, 0, imgSize.height, imgSize.width / 2, imgSize.height);

		const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojangstudios.png');
		const loadEmbed = new Discord.MessageEmbed()
			.setTitle("Minecraft Loading Screen")
			.setDescription("<:Checkmark:849224496232660992> Here's your Minecraft loading screen! Make sure to put it in: `<resourcepack>/assets/minecraft/textures/gui/title`")
			.setImage('attachment://mojangstudios.png');
		message.reply({ embeds: [loadEmbed], files: [attachment] });
	}
}
