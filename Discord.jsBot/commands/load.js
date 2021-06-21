module.exports = {
	name: 'load',
	description: 'Create a loading screen for minecraft texturepacks.',
	execute (message, args) {
		const Canvas = require('canvas');
		const probe = require('probe-image-size');
		const Discord = require('discord.js');

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

		//log msg
		console.log(message.member.user.tag + ' executed ^help with imgURL: ' + URL);

		//get imageSize and load image
		const imgSize = async () => {
			return await probe(URL, { rejectUnauthorized: false });
		}
		const img = async () => {
			return await Canvas.loadImage(URL);
		}

		//create doublesized canvas
		const canvas = Canvas.createCanvas(imgSize.width * 2, imgSize.height * 2);
		const context = canvas.getContext('2d');

		//position half of image top right
		context.drawImage(img, 0, 0, 0, 0, imgSize.width + imgSize.width / 2, 0, 0, 0);

		//position 2nd half bottom left
		
		//send canvas
		const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'mojang_studios.png');
		channel.send(attachment);
	}
}