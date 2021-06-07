module.exports = {
	name: 'load',
	execute(message, args) {

		const Discord = require('discord.js');
		//const Canvas = require('canvas');

		const base = new Image()
		const baseWidth = base.naturalWidth
		const baseHeight = base.naturalHeight
		console.log(baseWidth + 'x' + baseHeight)
		message.channel.send(baseWidth + 'x' + baseHeight)
		base.src = (args[0])

		//const loading = Canvas.createCanvas(baseWidth * 2, baseHeight * 2);
		//const context = loading.getContext('2d');
	}
}