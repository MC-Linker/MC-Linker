module.exports = {
	name: 'load',
	description: 'Create a loading screen for minecraft texturepacks.',
	execute (message, args) {
		const canvas = require('canvas');

		let URL;
		if (args[0]) {
			URL = (args[0]);
		} else if (message.attachments) {
			const attach = (message.attachments).array();
			URL = attach[0].url;
		}

		const img = async () => {
			return await canvas.loadImage(URL);
		}

		

		console.log(URL);
	}
}