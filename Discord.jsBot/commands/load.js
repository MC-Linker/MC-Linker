module.exports = {
	name: 'load',
	execute(message, args) {

		const Discord = require('discord.js');
		//const Canvas = require('canvas');
		const fs = require('fs');
		const request = require('request');
		const imgsize = require('image-size');

		let height;
		let width;
	
		function getImgSize() {
			var downloadImg = function(url, filename, callback){
			request.head(url, function(err, res, body){
				console.log('content-type:', res.headers['content-type']);
				console.log('content-length:', res.headers['content-name']);
			
				request(url).pipe(fs.createWriteStream(filename)).on('close', callback);
			});
			};
			
			downloadImg(args[0], './images/loadImage.png', function(){
				console.log('Downloaded image.');
			});

			const dimensions = imgsize('./images/loadImage.png');
			width = dimensions.width;
			height = dimensions.height;
		}
		

		console.log(height + 'x' + width)
		//const loading = Canvas.createCanvas(baseWidth * 2, baseHeight * 2);
		//const context = loading.getContext('2d');
	}
}