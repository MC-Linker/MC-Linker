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
		function getImgSize(url) {
			const downloadImg = function(filename, callback){
			request.head(url, function(err, res, body){
				if(err) {
					console.log(err)
				}
				console.log('content-type:', res.headers['content-type']);
				console.log('content-length:', res.headers['content-name']);
			
				request(url).pipe(fs.createWriteStream(filename)).on('close', callback);
			});
			};
			
			downloadImg('./images/loadImage.png', function(){
				console.log('Downloaded image.');
			});

			const dimensions = imgsize('./images/loadImage.png');
			console.log(dimensions.width, dimensions.height);
			width = dimensions.width;
			height = dimensions.height;
		}
		getImgSize(args[0]);
		
		console.log(height + 'x' + width)
		//const loading = Canvas.createCanvas(width * 2, height * 2);
		//const context = loading.getContext('2d');
	}
}