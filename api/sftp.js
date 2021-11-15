const sftp = require('ssh2-sftp-client');
const ftp = require('./ftp');
const plugin = require('./plugin');
const fs = require('fs');
module.exports = {
	get: function (getPath, putPath, message) {
		return new Promise(async (resolve, reject) => {
			fs.readFile('./ftp/' + message.guild.id + '.json', 'utf-8', async (err, ftpJson) => {
				if(err) {
					message.reply('<:Error:849215023264169985> Could not read ftp credentials. Please use `/ftp` first.');
					console.log('Error reading ftp file from disk: ', err);
					resolve(false);
				} else {
					const ftpData = JSON.parse(ftpJson);
					const host = ftpData.host;
					const user = ftpData.user;
					const pass = ftpData.password;
					const port = ftpData.port;
					const protocol = ftpData.protocol;

					if(protocol === 'ftp') { const ftpGet = await ftp.get(getPath, putPath, message); resolve(ftpGet); return; }
					else if(protocol === 'plugin') { const pluginGet = await plugin.get(getPath, putPath, message); resolve(pluginGet); return; }

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
							resolve(false);
						}
					} catch (err) {
						console.log('Could not connect to server with sftp.', err);
						resolve(false);
					}
				}
			});
		});
	},

	put: function (getPath, putPath, message) {
		return new Promise(async (resolve, reject) => {
			fs.readFile('./ftp/' + message.guild.id + '.json', 'utf-8', async (err, ftpJson) => {
				if(err) {
					message.reply('<:Error:849215023264169985> Could not read ftp credentials. Please use `/ftp` first.');
					console.log('Error reading ftp file from disk: ', err);
					resolve(false);
				} else {
					const ftpData = JSON.parse(ftpJson);
					const host = ftpData.host;
					const user = ftpData.user;
					const pass = ftpData.password;
					const port = ftpData.port;
					const protocol = ftpData.protocol;

					if(protocol === 'ftp') { const ftpPut = await ftp.put(getPath, putPath, message); resolve(ftpPut); return; }
					else if(protocol === 'plugin') { const pluginPut = await plugin.put(getPath, putPath, message); resolve(pluginPut); return; }

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
							resolve(true);
						} catch (err) {
							console.log('Could not upload files. Path: ' + getPath, err);
							message.reply('<:Error:849215023264169985> Could not upload files.');
							sftpClient.end();
							resolve(false);
						}
						console.log('File [' + getPath + '] succesfully uploaded');
						return;
					} catch (err) {
						console.log('Could not connect to server with sftp.', err);
						resolve(false);
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
				console.log('Connected with sftp.');
				resolve(true);
			} catch (err) {
				console.log('Could not connect to server with sftp.', err);
				resolve(false);
			}
		})
    },

	find: function(file, start, maxDepth, credentials) {
		return new Promise(async (resolve, reject) => {
			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: credentials.host,
					username: credentials.user,
					password: credentials.pass,
					port: credentials.port
				});
				const foundFile = await findFile(sftpClient, file, start, maxDepth);
				console.log('Found file: ' + foundFile);
				resolve(foundFile);
			} catch (err) {
				console.log('Could not connect to server with sftp.', err);
				resolve();
			}
		});
	}
}

async function findFile(sftpClient, file, path, depth) {
	if (path.split('/').length >= depth + 1) return undefined;

	const list = await sftpClient.list(path);
	console.log('List of [' + path + '] successful.');

	for (const item of list) {
		if (item.type === '-' && item.name === file) return path;
		else if (item.type === 'd') {
			let res = await findFile(file, `${path}/${item.name}`, depth);
			if (res === undefined) continue;
			else return res;
		}
	}
}