const ftp = require('ftp');
const fs = require('fs');
module.exports = {
	get: async function (host, user, pass, port, getPath, putPath, message) {
		return await new Promise((resolve, reject) => {

			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			try {
				ftpClient.connect({
				host: host,
				port: port,
				user: user,
				password: pass,
			});
			} catch (err) {
				console.log('Could not connect to server. ', err);
				message.reply('<:Error:849215023264169985> ' + 'Could not connect to server.');
				reject('error');
				return;
			} 

			ftpClient.on('ready', function() {
				ftpClient.get(getPath, function(err, stream) {
					if(err) {
						console.log('Could not download files. ', err);
						message.reply('<:Error:849215023264169985> ' + 'Could not download files. The User most likely never joined the server.');
						reject('error');
						return;
					}
					stream.once('close', function() {
						ftpClient.end();
						resolve('noice');
					});
					stream.pipe(fs.createWriteStream(putPath));
					console.log('File [' + getPath + '] succesfully downloaded');
				});
			}); 
		});
	},

	put: async function (host, user, pass, port, getPath, putPath, message) {
		await new Promise((resolve, reject) => {

			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			try {
				ftpClient.connect({
				host: host,
				port: port,
				user: user,
				password: pass,
			});
			} catch (err) {
				console.log('Could not connect to server. ', err);
				message.reply('<:Error:849215023264169985> ' + 'Could not connect to server.');
				reject('error');
				return;
			} 

			ftpClient.on('ready', function() {
				ftpClient.put(getPath, putPath, function(err) {
					if(err) {
						console.log('Could not download files. ', err);
						message.reply('<:Error:849215023264169985> ' + 'Could not download files. The User most likely never joined the server.');
						reject('error');
						return;
					}
					ftpClient.end();
					resolve('noice');
				});
			}); 
		});
	}
}