module.exports = {
	name: 'load',
	description: 'Create a loading screen for minecraft texturepacks.',
	execute (message, args) {
		const Canvas = require('canvas');
		const probe = require('probe-image-size');
		const Discord = require('discord.js');

		async function load() {
			//get URL of image
			let URL;
			if (args[0]) {
				URL = (args[0]);
			} else if (message.attachments) {
				try {
					const attach = (message.attachments).array();
					URL = attach[0].url;
				} catch (err) {
					console.log('Error getting URL of attach. ', err)
					message.channel.send('Invalid Image. ^help for correct usage.')
					return;
				}
				
			}

			console.log(message.member.user.tag + ' executed ^help with imgURL: ' + URL);

			//get imageSize
			const imgSize = await probe(URL, { rejectUnauthorized: false });
			console.log(imgSize());

			const img = await Canvas.loadImage(URL);

			const loadCanvas = Canvas.createCanvas(imgSize.width * 2, imgSize.height * 2);
			const context = loadCanvas.getContext('2d');

			//position half of image top right
			context.drawImage(img, 0, 0, 0, 0, imgSize.width + imgSize.width / 2, 0, 0, 0);

			//position 2nd half bottom left
			
			
			const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojang_studios.png');
			channel.send(attachment);
		}
	}
}