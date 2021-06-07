module.exports = {
	name: 'load',
	execute(message, args) {

		const Discord = require('discord.js');
		//const Canvas = require('canvas');

		const probe = require('probe-image-size');

		let width;
		let height;
		async function getSize() {
			let size = await probe('https://cdn.discordapp.com/attachments/844493685244297226/850708455156482048/cooked_mutton.png');
			width = size.width;
			height = size.height;
		}
		getSize();
		
		console.log(height + 'x' + width)
		//const loading = Canvas.createCanvas(baseWidth * 2, baseHeight * 2);
		//const context = loading.getContext('2d');
	}
}