module.exports = {
	name: 'load',
	execute(message, args) {

		const Discord = require('discord.js');
		//const Canvas = require('canvas');

		var gm = require('gm');
		var request = require('request');
		var url = (args[0]);
		
		var stream = request(url);
		gm(stream, './img.jpg').size({ bufferStream: true }, function (err, size) {
			if (err) { throw err; }
			console.log(size);
		})

		//const loading = Canvas.createCanvas(baseWidth * 2, baseHeight * 2);
		//const context = loading.getContext('2d');
	}
}