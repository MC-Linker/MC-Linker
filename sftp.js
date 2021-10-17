const sftp = require('ssh2-sftp-client');
const ftp = require('./ftp');
const fs = require('fs');
module.exports = {
	get: function (getPath, putPath, message) {
		return new Promise(async (resolve, reject) => {
			fs.readFile('./ftp/' + message.guild.id + '.json', async (err, ftpJson) => {
				if(err) {
					message.reply('<:Error:849215023264169985> Could not read ftp credentials. Please use `/ftp` first.');
					console.log('Error reading ftp file from disk: ', err);
					resolve();
				} else {
					// @ts-ignore
					const ftpData = JSON.parse(ftpJson);
					const host = ftpData.host;
					const user = ftpData.user;
					const pass = ftpData.password;
					const port = ftpData.port;
					const protocol = ftpData.protocol;

					if(protocol === 'ftp') { const ftpGet = await ftp.get(getPath, putPath, message); resolve(ftpGet); return; }
					try {
						const sftpClient = new sftp;
						await sftpClient.connect({
							host: host,
							username: user,
							password: pass,
							port: port
						});

						try {
							await sftpClient.fastGet(getPath, putPath);
							sftpClient.end();
							console.log('File [' + getPath + '] succesfully downloaded');
							resolve(true);
						} catch (err) {
							console.log('Could not download files. Path: ' + getPath, err);
							message.reply('<:Error:849215023264169985> Could not download files. The User never joined the server or the worldpath is incorrect.');
							sftpClient.end();
							resolve();
						}
					} catch (err) {
						console.log('Could not connect to server with sftp.', err);
						resolve();
					}
				}
			});
		});
	},

	put: function (getPath, putPath, message) {
		return new Promise(async (resolve, reject) => {
			fs.readFile('./ftp/' + message.guild.id + '.json', async (err, ftpJson) => {
				if(err) {
					message.reply('<:Error:849215023264169985> Could not read ftp credentials. Please use `/ftp` first.');
					console.log('Error reading ftp file from disk: ', err);
					resolve();
				} else {
					// @ts-ignore
					const ftpData = JSON.parse(ftpJson);
					const host = ftpData.host;
					const user = ftpData.user;
					const pass = ftpData.password;
					const port = ftpData.port;
					const protocol = ftpData.protocol;

					if(protocol === 'ftp') { await ftp.put(getPath, putPath, message); resolve(true); return; }

					try {
						const sftpClient = new sftp;
						await sftpClient.connect({
							host: host,
							username: user,
							password: pass,
							port: port,
						});

						try {
							await sftpClient.fastPut(getPath, putPath);
							sftpClient.end();
							resolve();
						} catch (err) {
							console.log('Could not upload files. Path: ' + getPath, err);
							message.reply('<:Error:849215023264169985> Could not upload files.');
							sftpClient.end();
							resolve();
						}
						return console.log('File [' + getPath + '] succesfully uploaded');
					} catch (err) {
						console.log('Could not connect to server with sftp.', err);
						resolve();
					}
				}
			});
		});
	},

    connect: function (credentials) {
		return new Promise(async (resolve, reject) => {
			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: credentials.host,
					username: credentials.user,
					password: credentials.pass,
					port: credentials.port
				});
				sftpClient.end();
				console.log('Connected with sftp.')
				resolve(true);
			} catch (err) {
				console.log('Could not connect to server with sftp.', err);
				resolve();
			}
		})
    }
}