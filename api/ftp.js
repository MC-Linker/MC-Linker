const ftp = require('ftp');
const fs = require('fs');
const { promisify } = require('util');
const utils = require('./utils');
const sftp = require('./sftp');
const plugin = require('./plugin');
module.exports = {
	get: function (getPath, putPath, message) {
		return new Promise(async resolve => {
			const protocol = await utils.getProtocol(message.guild.id, message);

			//Redirect to other protocols
			if(protocol === 'sftp') return resolve(await sftp.get(getPath, putPath, message));
			else if(protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, message));

			const ftpData = await utils.getServerData(message.guild.id, message);
			if(!ftpData) return;

			const ftpClient = new ftp();
			ftpClient.on('error', err => {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				resolve(false);
			});

			try {
				ftpClient.connect({
					host: ftpData.host,
					user: ftpData.user,
					password: ftpData.password,
					port: ftpData.port,
					secureOptions: {
						rejectUnauthorized: false,
					},
				});
			} catch (err) {
				console.log('Could not connect to server. ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				resolve(false);
			}

			ftpClient.on('ready', () => {
				ftpClient.get(getPath, (err, stream) => {
					if(err) {
						console.log('Could not download files. Path: ' + getPath, err);
						message.reply('<:Error:849215023264169985> Could not download files. The User never joined the server or the world path is incorrect.');
						resolve(false);
					} else {
						stream.pipe(fs.createWriteStream(putPath));
						stream.once('close', () => {
							ftpClient.end();
							resolve(true);
							console.log(`File [${getPath}] successfully downloaded`);
						});
					}
				});
			});
		});
	},

	put: function (getPath, putPath, message) {
		return new Promise(async resolve => {
			const protocol = await utils.getProtocol(message.guild.id, message);

			//Redirect to other protocols
			if(protocol === 'sftp') return resolve(await sftp.get(getPath, putPath, message));
			else if(protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, message));

			const ftpData = await utils.getServerData(message.guild.id, message);
			if(!ftpData) return;

			const ftpClient = new ftp();
			ftpClient.on('error', err => {
				console.log('ftpError! ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				resolve(false);
			});

			try {
				ftpClient.connect({
					host: ftpData.host,
					user: ftpData.user,
					password: ftpData.password,
					port: ftpData.port,
					secureOptions: {
						rejectUnauthorized: false,
					},
				});
			} catch (err) {
				console.log('Could not connect to server. ', err);
				message.reply('<:Error:849215023264169985> Could not connect to server.');
				resolve(false);
			}

			ftpClient.on('ready', () => {
				ftpClient.put(getPath, putPath, err => {
					if (err) {
						console.log(`Could not put files. Path: ${getPath}`, err);
						message.reply('<:Error:849215023264169985> Could not upload files.');
						resolve(false);
					} else {
						ftpClient.end();
						ftpClient.on('close', () => {
							console.log(`File [${putPath}] successfully uploaded.`);
							resolve(true);
						});
					}
				});
			});
		});
	},

	connect: function(credentials) {
		return new Promise(resolve => {
			const ftpClient = new ftp();
			ftpClient.on('error', err => {
				console.log('Could not connect to server.', err);
				resolve(false);
			});
			try {
				ftpClient.connect({
					host: credentials.host,
					port: credentials.port,
					user: credentials.user,
					password: credentials.pass,
					secureOptions: {
						rejectUnauthorized: false,
					},
				});
			} catch (err) {
				console.log('Could not connect to server.', err);
				resolve(false);
			}
			ftpClient.on('ready', () => {
				ftpClient.end();
				console.log('Connected with ftp.');
				resolve(true);
			});
		});
	},

	find: function(file, start, maxDepth, credentials) {
		return new Promise(resolve => {
			const ftpClient = new ftp();
			ftpClient.on('error', err => {
				console.log('ftpError! ', err);
				resolve();
			});
			try {
				ftpClient.connect({
					host: credentials.host,
					port: credentials.port,
					user: credentials.user,
					password: credentials.pass,
					secureOptions: {
						rejectUnauthorized: false,
					},
				});
			} catch (err) {
				console.log('Could not connect to server.', err);
				resolve();
			}
			ftpClient.on('ready', async () => {
				const foundFile = await findFile(ftpClient, file, start, maxDepth);
				console.log(`Found file: ${foundFile}`);
				resolve(foundFile);
			});
		});
	}
}

async function findFile(ftpClient, file, path, maxDepth) {
	if (path.split('/').length >= maxDepth++) return;

	const list = await promisify(ftpClient.list).call(ftpClient, path);

	for (const item of list) {
		if (item.type === '-' && item.name === file) return path;
		else if (typeof item === 'string' && item.startsWith('-') && item.split(' ').pop() === file) return path;

		else if((typeof item === 'string' && item.startsWith('d'))) {
			let res = await findFile(ftpClient, file, `${path}/${item.split(' ').pop()}`, maxDepth);
			if (res) return res;
		} else if(item.type === 'd') {
			let res = await findFile(ftpClient, file, `${path}/${item.name}`, maxDepth);
			if (res) return res;
		}
	}
}