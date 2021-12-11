const sftp = require('ssh2-sftp-client');
const fs = require('fs');
const ftp = require('./ftp');
const plugin = require('./plugin');
const utils = require('./utils');
module.exports = {
	get: function (getPath, putPath, message) {
		return new Promise(async (resolve, reject) => {
			const protocol = await utils.getProtocol(message.guild.id, message);

			if(protocol === 'sftp') {
				resolve(await sftp.get(getPath, putPath, message));
				return;
			} else if(protocol === 'plugin') {
				resolve(await plugin.get(getPath, putPath, message));
				return;
			}

			const ftpData = await utils.getServerData(message.guild.id, message);
			if(!ftpData) return;

			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: ftpData.host,
					username: ftpData.user,
					password: ftpData.password,
					port: ftpData.port
				});

				try {
					await sftpClient.fastGet(getPath, putPath);
					sftpClient.end();
					console.log(`File [${getPath}] successfully downloaded`);
					resolve(true);
				} catch (err) {
					console.log(`Could not download files. Path: ${getPath}`, err);
					message.reply('<:Error:849215023264169985> Could not download files. The User never joined the server or the world path is incorrect.');
					sftpClient.end();
					resolve(false);
				}
			} catch (err) {
				console.log('Could not connect to server with sftp.', err);
				resolve(false);
			}
		});
	},

	put: function (getPath, putPath, message) {
		return new Promise(async (resolve, reject) => {
			const protocol = await utils.getProtocol(message.guild.id, message);

			if(protocol === 'sftp') {
				resolve(await sftp.get(getPath, putPath, message));
				return;
			} else if(protocol === 'plugin') {
				resolve(await plugin.get(getPath, putPath, message));
				return;
			}

			const ftpData = await utils.getServerData(message.guild.id, message);
			if(!ftpData) return;

			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: ftpData.host,
					username: ftpData.user,
					password: ftpData.password,
					port: ftpData.port,
				});

				try {
					await sftpClient.fastPut(getPath, putPath);
					sftpClient.end();
					console.log(`File [${getPath}] successfully uploaded`);
					resolve(true);
				} catch (err) {
					console.log(`Could not upload files. Path: ${getPath}`, err);
					message.reply('<:Error:849215023264169985> Could not upload files.');
					sftpClient.end();
					resolve(false);
				}
			} catch (err) {
				console.log('Could not connect to server with sftp.', err);
				resolve(false);
			}
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
				console.log(`Found file: ${foundFile}`);
				resolve(foundFile);
			} catch (err) {
				console.log('Could not connect to server with sftp.', err);
				resolve();
			}
		});
	}
}

async function findFile(sftpClient, file, path, depth) {
	if (path.split('/').length >= depth + 1) return;

	const list = await sftpClient.list(path);

	for (const item of list) {
		if (item.type === '-' && item.name === file) return path;
		else if (item.type === 'd') {
			let res = await findFile(sftpClient, file, `${path}/${item.name}`, depth);
			if (res) return res;
		}
	}
}