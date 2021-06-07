module.exports = {
	name: 'load',
	execute(message, args) {

		const Discord = require('discord.js');
		//const Canvas = require('canvas');

		function getMeta(url){   
			var img = new Image();
			img.addEventListener("load", function(){
				console.log(this.naturalWidth +' '+ this.naturalHeight);
			});
			img.src = url;
		}
		
		getMeta(args[0])

		//const loading = Canvas.createCanvas(baseWidth * 2, baseHeight * 2);
		//const context = loading.getContext('2d');
	}
}