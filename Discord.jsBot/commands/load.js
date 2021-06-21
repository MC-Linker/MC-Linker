module.exports = {
	name: 'load',
	description: 'Create a loading screen for minecraft texturepacks.',
	execute (message, args) {
		const Canvas = require('canvas');
		const probe = require('probe-image-size');

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
		console.log(URL);

		const imgSize = async () => {
			return await probe(URL, { rejectUnauthorized: false });
		}
		const img = async () => {
			return await Canvas.loadImage(URL);
		}
		
		const canvas = Canvas.createCanvas(imgSize.width * 2, imgSize.height * 2);
	}
}