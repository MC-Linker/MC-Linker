module.exports = {
	name: 'txp',
	description: 'Tools for minecraft texturepacks. \n**USAGE**: txp load <attachmenmt/imagelink> => Outputs a loading screen from the attachment or the link. \ntxp black => Outputs a file which makes the loading screen black.',
	execute (message, args) {
		const Canvas = require('canvas');
		const probe = require('probe-image-size');
		const Discord = require('discord.js');

		if(args[0] === 'load' || args[0] === 'loading' || args[0] === 'loadingscreen' || args[0] === 'txpload') {
			async function load() {
				//get URL of image
				let URL;
				if (args[1]) {
					URL = (args[1]);
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
	
				console.log(message.member.user.tag + ' executed ^load with imgURL: ' + URL);
	
				//get imageSize
				let imgSize;
				try {
					// @ts-ignore
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
				
				const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojangstudios.png');
				const loadEmbed = new Discord.MessageEmbed()
				.setTitle("Minecraft Loading Screen")
				.setDescription("Here's your Minecraft loading screen! Make sure to put it in: <resourcepack>/assets/minecraft/textures/gui/title")
				// @ts-ignore
				.attachFiles(attachment)
				.setImage('attachment://mojangstudios.png');
				message.channel.send(loadEmbed);
			}
			load();
		} else if(args[0] === 'black' || args[0] === 'loadblack' || args[0] === 'blackload' || args[0] === 'txpblack') {

		}
	}
}