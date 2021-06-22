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
					console.log('Error while trying to get imagesize. ', err);
					message.channel.send('<:Error:849215023264169985> Cannot get URL of image. ^help for correct usage.');
					return;
				}
				
			}

			console.log(message.member.user.tag + ' executed ^help with imgURL: ' + URL);

			//get imageSize
			let imgSize;
			try {
				imgSize = await probe(URL, { rejectUnauthorized: false });
			} catch (err) {
				console.log('Error while trying to get imagesize. ', err);
				message.channel.send('<:Error:849215023264169985> Cannot get size of image. ^help for correct usage.');
				return;
			}
			
			/*if(imgSize.type !== 'png' && imgSize.type !== 'jpg') {
				console.log('Invalid imagetype: ' + imgSize.type);
				message.channel.send('<:Error:849215023264169985> Invalid image type [' + imgSize.type + ']. Supported types: **jpg, png**');
				return;
			}*/

			const loadCanvas = Canvas.createCanvas(imgSize.width * 2, imgSize.height * 2);
			const context = loadCanvas.getContext('2d');
			const img = await Canvas.loadImage(URL);

			//position half of image top right
			context.drawImage(img, 0, 0, imgSize.width / 2, imgSize.height, imgSize.width * 1.5, 0, imgSize.width / 2, imgSize.height);

			//position 2nd half bottom left
			context.drawImage(img, imgSize.width / 2, 0, imgSize.width / 2, imgSize.height, 0, imgSize.height, imgSize.width / 2, imgSize.height);
			
			const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojang_studios.png');
			message.channel.send(attachment);
		}
		load();
	}
}