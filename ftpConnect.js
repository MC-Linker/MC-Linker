const ftp = require('ftp');
const sftp = require('ssh2-sftp-client');
const fs = require('fs');
module.exports = {

	get: async function (getPath, putPath, message) {
		return await new Promise(async (resolve, reject) => {
			reject('error')
			try {
				const ftpJson = fs.readFileSync('./ftp/' + message.guild.id + '.json');
				// @ts-ignore
				const ftpData = JSON.parse(ftpJson);
				const host = ftpData.host;
				const user = ftpData.user;
				const pass = ftpData.password;
				const port = ftpData.port;

				
				try {
					const sftpClient = new sftp;
					await sftpClient.connect({
						host: host,
						username: user,
						password: pass,
						port: port
					});
					
					sftpClient.on('error', err => {
						console.log('sftpError! ', err);
						message.reply('<:Error:849215023264169985> Could not connect to server.');
						reject('error');
						return;
					})

					try {
						await sftpClient.fastGet(getPath, putPath);
						sftpClient.end();
					} catch (err) {
						console.log('Could not download files. Path: ' + getPath, err);
						message.reply('<:Error:849215023264169985> Could not download files. The User never joined the server or the worldpath is incorrect.');
						sftpClient.end();
						reject('error');
						return;
					}
					console.log('File [' + getPath + '] succesfully downloaded');
					resolve('noice');

				} catch (err) {
					console.log('Could not connect to server with sftp. Trying ftp... ', err);

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
						message.reply('<:Error:849215023264169985> Could not connect to server.');
						reject('error');
						return;
					} 
					ftpClient.on('ready', function() {
						ftpClient.get(getPath, function(err, stream) {
							if(err) {
								console.log('Could not download files. Path: ' + getPath, err);
								message.reply('<:Error:849215023264169985> ' + 'Could not download files. The User never joined the server or the worldpath is incorrect.');
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
					
				}
				
			} catch (err) {
				message.reply('<:Error:849215023264169985> Could not read ftp credentials. Please use `^ftp`.')
				console.log('Error reading ftp file from disk: ', err);
				reject('error')
				return;
			}
		});
	},

	put: async function (getPath, putPath, message) {
		return await new Promise(async (resolve, reject) => {
			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: host,
					username: user,
					password: pass,
					port: port
				});
				
				sftpClient.on('error', err => {
					console.log('sftpError! ', err);
					message.reply('<:Error:849215023264169985> Could not connect to server.');
					reject('error');
					return;
				})

				try {
					await sftpClient.fastPut(getPath, putPath);
					sftpClient.end();
				} catch (err) {
					console.log('Could not upload files. Path: ' + getPath, err);
					message.reply('<:Error:849215023264169985> Could not upload files.');
					sftpClient.end();
					reject('error');
					return;
				}
				console.log('File [' + getPath + '] succesfully downloaded');
				resolve('noice');

			} catch (err) {
				console.log('Could not connect to server with sftp. Trying ftp... ', err);

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
					message.reply('<:Error:849215023264169985> Could not connect to server.');
					reject('error');
					return;
				} 
				ftpClient.on('ready', function() {
					ftpClient.put(getPath, putPath, function(err) {
						if(err) {
							console.log('Could not put files. Path: ' + getPath, err);
							message.reply('<:Error:849215023264169985> Could not upload files.');
							reject('error');
							return;
						}
						ftpClient.end();
						resolve('noice');
					});
				});
			}
		});
	},

	append: async function (getPath, putPath, message) {
		return await new Promise(async (resolve, reject) => {
			const ftpClient = new ftp();
			ftpClient.on('error', function(err) {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				reject('error');
				return;
			});

			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: host,
					username: user,
					password: pass,
					port: port
				});
				
				sftpClient.on('error', err => {
					console.log('sftpError! ', err);
					message.reply('<:Error:849215023264169985> Could not connect to server.');
					reject('error');
					return;
				})

				try {
					await sftpClient.fastPut(getPath, putPath);
					sftpClient.end();
				} catch (err) {
					console.log('Could not upload files. Path: ' + getPath, err);
					message.reply('<:Error:849215023264169985> Could not upload files.');
					sftpClient.end();
					reject('error');
					return;
				}
				console.log('File [' + getPath + '] succesfully downloaded');
				resolve('noice');

			} catch (err) {
				console.log('Could not connect to server with sftp. Trying ftp... ', err);

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
					message.reply('<:Error:849215023264169985> Could not connect to server.');
					reject('error');
					return;
				} 
				ftpClient.on('ready', function() {
					ftpClient.append(getPath, putPath, function(err) {
						if(err) {
							console.log('Could not append files. Path: ' + getPath, err);
							message.reply('<:Error:849215023264169985> ' + 'Could not upload files.');
							reject('error');
							return;
						}
						ftpClient.end();
						resolve('noice');
					});
				});
			} 
		});
	}
}