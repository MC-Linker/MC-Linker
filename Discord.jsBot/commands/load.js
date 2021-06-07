module.exports = {
	name: 'load',
	execute(message, args) {

		const Discord = require('discord.js');
		//const Canvas = require('canvas');

		const probe = require('probe-image-size');

		let width;
		let height;
		/**
		 * @param {string} url
		 */
		async function getSize(url) {
			let size = await probe(url);
			width = size.width;
			height = size.height;
		}
		getSize(args[0]);
		
		console.log(height + 'x' + width)
		//const loading = Canvas.createCanvas(baseWidth * 2, baseHeight * 2);
		//const context = loading.getContext('2d');
	}
}