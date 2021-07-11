const ftp = require('ftp');
const fs = require('fs');
module.exports = {
	get: async function (getPath, putPath, message) {
		return await new Promise((resolve, reject) => {

			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			let worldPath;
				try {
					const ftpJson = fs.readFileSync('./ftp/' + message.guild.id + '.json');
					// @ts-ignore
					const ftpData = JSON.parse(ftpJson);
					const host = ftpData.host;
					const user = ftpData.user;
					const pass = ftpData.password;
					const port = ftpData.port;
					worldPath = ftpData.path;
					
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
					
				} catch (err) {
					message.reply('<:Error:849215023264169985> ' + 'Could not read ftp credentials. Please contact a server-admin.')
					console.log('Error reading ftp file from disk: ', err);
					return;
				}

			ftpClient.on('ready', function() {
				ftpClient.get(worldPath + getPath, function(err, stream) {
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

	put: async function (getPath, putPath, message) {
		await new Promise((resolve, reject) => {

			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			let worldPath;
			try {
				const ftpJson = fs.readFileSync('./ftp/' + message.guild.id + '.json');
				// @ts-ignore
				const ftpData = JSON.parse(ftpJson);
				const host = ftpData.host;
				const user = ftpData.user;
				const pass = ftpData.password;
				const port = ftpData.port;
				worldPath = ftpData.path;
				
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
				
			} catch (err) {
				message.reply('<:Error:849215023264169985> ' + 'Could not read ftp credentials. Please contact a server-admin.')
				console.log('Error reading ftp file from disk: ', err);
				return;
			}

			ftpClient.on('ready', function() {
				ftpClient.put(worldPath + getPath, putPath, function(err) {
					if(err) {
						console.log('Could not put files. ', err);
						message.reply('<:Error:849215023264169985> ' + 'Could not upload files.');
						reject('error');
						return;
					}
					ftpClient.end();
					resolve('noice');
				});
			}); 
		});
	},

	append: async function (getPath, putPath, message) {
		await new Promise((resolve, reject) => {

			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			let worldPath;
			try {
				const ftpJson = fs.readFileSync('./ftp/' + message.guild.id + '.json');
				// @ts-ignore
				const ftpData = JSON.parse(ftpJson);
				const host = ftpData.host;
				const user = ftpData.user;
				const pass = ftpData.password;
				const port = ftpData.port;
				worldPath = ftpData.path;
				
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
				
			} catch (err) {
				message.reply('<:Error:849215023264169985> ' + 'Could not read ftp credentials. Please contact a server-admin.')
				console.log('Error reading ftp file from disk: ', err);
				return;
			}

			ftpClient.on('ready', function() {
				ftpClient.append(worldPath + getPath, putPath, function(err) {
					if(err) {
						console.log('Could not append files. ', err);
						message.reply('<:Error:849215023264169985> ' + 'Could not upload files.');
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