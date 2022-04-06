const sftp = require('ssh2-sftp-client');
const plugin = require('./plugin');
const utils = require('./utils');
const { keys, addPh} = require('./messages');

module.exports = {
	get: function (getPath, putPath, message) {
		return new Promise(async resolve => {
			const protocol = await utils.getProtocol(message.guild.id, message);

			//Redirect to other protocols
			if(protocol === 'sftp') return resolve(await sftp.get(getPath, putPath, message));
			else if(protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, message));

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
					message.respond(keys.api.ftp.success.get, { "path": getPath });
					resolve(true);
				} catch (err) {
					message.respond(keys.api.ftp.errors.could_not_get, { "path": getPath, "error": err });
					sftpClient.end();
					resolve(false);
				}
			} catch (err) {
				message.respond(keys.api.ftp.errors.could_not_connect, { "error": err });
				resolve(false);
			}
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
					message.respond(keys.api.ftp.success.put, { "path": putPath });
					resolve(true);
				} catch (err) {
					message.respond(keys.api.ftp.errors.could_not_put, { "path": putPath, "error": err });
					sftpClient.end();
					resolve(false);
				}
			} catch (err) {
				message.respond(keys.api.ftp.errors.could_not_connect, { "error": err });
				resolve(false);
			}
		});
	},

    connect: function (credentials) {
		return new Promise(async resolve => {
			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: credentials.host,
					username: credentials.user,
					password: credentials.pass,
					port: credentials.port
				});
				sftpClient.end();
				console.log(keys.api.ftp.success.connect.console);
				resolve(true);
			} catch (err) {
				console.log(addPh(keys.api.ftp.errors.could_not_connect, { "error": err }));
				resolve(false);
			}
		})
    },

	find: function(file, start, maxDepth, credentials) {
		return new Promise(async resolve => {
			try {
				const sftpClient = new sftp;
				await sftpClient.connect({
					host: credentials.host,
					username: credentials.user,
					password: credentials.pass,
					port: credentials.port
				});

				const foundFile = await findFile(sftpClient, file, start, maxDepth);
				console.log(keys.api.ftp.success.find.console, { "path": foundFile });
				resolve(foundFile);
			} catch (err) {
				console.log(addPh(keys.api.ftp.errors.could_not_connect, { "error": err }));
				resolve(false);
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