module.exports = {
	name: 'txp',
	aliases: [''],
	usage: 'txp load/black',
    example: 'txp black **//** txp load <imageLink/imageAttachment/@mention>',
	description: 'Tools for minecraft texturepacks. \ntxp load => Outputs a loading screen from the attachment, ping or link. \ntxp black => Outputs a file which makes the loading screen black.',
	async execute (message, args) {
		const Canvas = require('canvas');
		const probe = require('probe-image-size');
		const Discord = require('discord.js');

		if(!args[0]) {
			console.log(message.member.user.tag + ' executed ^txp without args in ' + message.guild.name);
			message.reply(':warning: Do you want to create a loading screen => `^txp load`\n:warning: Or do you want a black loading screen => `^txp black`');
			return;
		}

		if(args[0] === 'load' || args[0] === 'loading' || args[0] === 'loadingscreen' || args[0] === 'txpload') {
			//get URL of image
			let URL;
			if (message.attachments.size) {
				try {
					URL = message.attachments.first().url;
				} catch (err) {
					console.log(message.member.user.tag + ' executed ^txp load. Couldnt get image url in ' + message.guild.name, err);
					message.channel.send('<:Error:849215023264169985> Cannot get URL of image. Please attach an image, ping someone or give an image url as argument.');
					return;
				}
			} else if (message.mentions.users.size) {
				URL = message.mentions.users.first().avatarURL({format: 'png'});
			} else if (args[1]) {
				URL = (args[1]);
			} else {
				console.log(message.member.user.tag + ' executed ^txp load without url or attach in ' + message.guild.name);
				message.reply(':warning: Please attach an image, ping someone or give an image url as argument.');
				return;
			}

			console.log(message.member.user.tag + ' executed ^txp load with imgURL: ' + URL + ' in ' + message.guild.name);

			//get imageSize
			let imgSize;
			try {
				imgSize = await probe(URL, { rejectUnauthorized: false });
			} catch (err) {
				console.log('Error while trying to get imagesize. ', err);
				message.channel.send('<:Error:849215023264169985> Cannot get size of image. `^help txp` for correct usage.');
				return;
			}

			if(imgSize.type !== 'png' && imgSize.type !== 'jpg') {
				console.log('Invalid imagetype: ' + imgSize.type);
				message.channel.send('<:Error:849215023264169985> Invalid image type [**' + imgSize.type + '**]. Supported types: **jpg, png**');
				return;
			}

			const loadCanvas = Canvas.createCanvas(imgSize.height * 2, imgSize.height * 2);
			const context = loadCanvas.getContext('2d');
			let img;
			try {
				img = await Canvas.loadImage(URL);
			} catch(err) {
				console.log('Error while trying to load img. ', err);
				message.channel.send('<:Error:849215023264169985> Unsupported image type. `^help canvas` for correct usage.');
				return;
			}

			//position half of image top right
			context.drawImage(img, 0, 0, imgSize.width / 2, imgSize.height, loadCanvas.width - (imgSize.width / 2), 0, imgSize.width / 2, imgSize.height);

			//position 2nd half bottom left
			context.drawImage(img, imgSize.width / 2, 0, imgSize.width / 2, imgSize.height, 0, imgSize.height, imgSize.width / 2, imgSize.height);

			const attachment = new Discord.MessageAttachment(loadCanvas.toBuffer(), 'mojangstudios.png');
			const loadEmbed = new Discord.MessageEmbed()
			.setTitle("Minecraft Loading Screen")
			.setDescription("<:Checkmark:849224496232660992> Here's your Minecraft loading screen! Make sure to put it in: `<resourcepack>/assets/minecraft/textures/gui/title`")
			.setImage('attachment://mojangstudios.png');
			message.channel.send({ embeds: [loadEmbed], files: [attachment] });

		} else if(args[0] === 'black' || args[0] === 'loadblack' || args[0] === 'blackload' || args[0] === 'txpblack') {
			console.log(message.member.user.tag + ' executed ^txp black in ' + message.guild.name);

			const blackFile = new Discord.MessageAttachment('./color.properties');
        	message.channel.send({ content: '<:Checkmark:849224496232660992> Heres your black loading screen file. Make sure to put it in: `<resourcepack>/assets/minecraft/optifine`', files: [blackFile] });
		} else {
			console.log(message.member.user.tag + ' executed non-existent ^txp argument ' + args[0] + ' in ' + message.guild.name);
			message.reply(':warning: This argument [**' + args[0] + '**] does not exist. You can only use `^txp load` and `^txp black`.');
		}
	}
}
