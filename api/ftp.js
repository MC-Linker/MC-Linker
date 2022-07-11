const { FtpFileSystem: ftp, SftpFileSystem: sftp } = require('ftp-sftp');
const fs = require('fs-extra');
const utils = require('./utils');
const plugin = require('./plugin');
const { keys, addPh, ph, defaultMessage } = require('./messages');

function get(getPath, putPath, guildId, message = defaultMessage) {
	return new Promise(async resolve => {
		const ftpData = await utils.getServerData(guildId, message);
		if (!ftpData) return resolve(false);

		//Redirect to plugin
		if (ftpData.protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, guildId, message));

		const ftpClient = await getFtpClient(ftpData, message);
		if (!ftpClient) return resolve(false);

		try {
			const file = await ftpClient.get(getPath);

			// await fs.ensureFile(putPath);
			const writeStream = fs.createWriteStream(putPath);

			file.pipe(writeStream);
			file.on('error', err => {
				message.respond(keys.api.ftp.errors.could_not_stream, { "path": getPath, "error": err });
				resolve(false);
			});
			writeStream.on('finish', async () => {
				message.respond(keys.api.ftp.success.get, { "path": getPath });
				ftpClient.client.end();

				resolve(await fs.readFile(putPath));
			});
		} catch(err) {
			message.respond(keys.api.ftp.errors.could_not_get, { "path": putPath }, ph.fromError(err));
			resolve(false);
		}
	});
}

function put(getPath, putPath, guildId, message = defaultMessage) {
	return new Promise(async resolve => {
		const ftpData = await utils.getServerData(guildId, message);
		if (!ftpData) return resolve(false);

		//Redirect to plugin
		if (ftpData.protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, guildId, message));

		const ftpClient = await getFtpClient(ftpData, message);
		if (!ftpClient) return resolve(false);

		try {
			await ftpClient.put(fs.createReadStream(getPath), putPath);
			ftpClient.client.end();
		} catch(err) {
			message.respond(keys.api.ftp.errors.could_not_put, { "path": putPath }, ph.fromError(err));
			resolve(false);
		}

		message.respond(keys.api.ftp.success.put, { "path": putPath });
		resolve(true);
	});
}

function connect(credentials) {
	return new Promise(async resolve => {
		//Try connecting with ftp
		credentials.protocol = 'ftp';
		const ftpConnect = await tryConnect();
		if(ftpConnect) return resolve(credentials.protocol);

		//Try connecting with sftp
		credentials.protocol = 'sftp';
		const sftpConnect = await tryConnect();
		if(sftpConnect) resolve(credentials.protocol);
		else resolve(false);


		async function tryConnect() {
			const ftpClient = await getFtpClient(credentials);
			if (!ftpClient) return false;
			ftpClient.client.end();

			console.log(addPh(keys.api.ftp.success.connect.console, { "protocol": credentials.protocol }));
			return true;
		}
	});
}

function find(file, start, maxDepth, credentials) {
	return new Promise(async resolve => {
		const ftpClient = await getFtpClient(credentials);
		if (!ftpClient) return resolve(false);

		const foundFile = await findFile(ftpClient, file, start, maxDepth);
		ftpClient.client.end();
		if(!foundFile) return resolve(false);

		console.log(addPh(keys.api.ftp.success.find.console, { "path": foundFile }));
		resolve(foundFile);
	});
}

async function findFile(ftpClient, file, path, maxDepth) {
	if (path.split('/').length >= maxDepth++) return;

	const list = await ftpClient.list(path);

	for (const item of list) {
		if (!item.isDirectory() && item.getName() === file) return path;
		else if(item.isDirectory()) {
			let res = await findFile(ftpClient, file, `${path}/${item.getName()}`, maxDepth);
			if (res) return res;
		}
	}
}

async function getFtpClient(credentials, message = defaultMessage) {
	try {
		if(credentials.protocol === 'ftp') return await ftp.create(credentials.host, credentials.port, credentials.user, credentials.password);
		if(credentials.protocol === 'sftp') return await sftp.create(credentials.host, credentials.port, credentials.user, credentials.password);
	} catch(err) {
		message.respond(keys.api.ftp.errors.could_not_connect, ph.fromError(err), { "protocol": credentials.protocol });
		return false;
	}
}

module.exports = { get, put, connect, find };