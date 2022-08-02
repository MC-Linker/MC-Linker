const { FtpFileSystem: ftp, SftpFileSystem: sftp } = require('ftp-sftp');
const fs = require('fs-extra');
const utils = require('./utils');
const plugin = require('./plugin');
const { keys, addPh, ph, defaultMessage } = require('./messages');

function get(getPath, putPath, credentials, message = defaultMessage) {
	return new Promise(async resolve => {
		const ftpData = await getData(credentials, message);
		if (!ftpData) return resolve(false);

		//Redirect to plugin
		if (ftpData.protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, credentials, message));

		const ftpClient = await getFtpClient(ftpData, message);
		if (!ftpClient) return resolve(false);

		try {
			await fs.ensureFile(putPath);

			const file = await ftpClient.get(getPath);
			// await fs.ensureFile(putPath);
			const writeStream = fs.createWriteStream(putPath);

			file.pipe(writeStream);
			file.on('error', err => {
				message.respond(keys.api.ftp.errors.could_not_stream, { "path": getPath, "error": err });

				// noinspection JSUnresolvedVariable
				ftpClient.client.end();
				resolve(false);
			});
			writeStream.on('finish', async () => {
				message.respond(keys.api.ftp.success.get, { "path": getPath });
				// noinspection JSUnresolvedVariable
				ftpClient.client.end();

				resolve(await fs.readFile(putPath));
			});
		} catch(err) {
			message.respond(keys.api.ftp.errors.could_not_get, { "path": getPath }, ph.error(err));
			resolve(false);
		}
	});
}

function put(getPath, putPath, credentials, message = defaultMessage) {
	return new Promise(async resolve => {
		const ftpData = await getData(credentials, message);
		if (!ftpData) return resolve(false);

		//Redirect to plugin
		if (ftpData.protocol === 'plugin') return resolve(await plugin.get(getPath, putPath, credentials, message));

		const ftpClient = await getFtpClient(ftpData, message);
		if (!ftpClient) return resolve(false);

		try {
			await ftpClient.put(fs.createReadStream(getPath), putPath);
		} catch(err) {
			message.respond(keys.api.ftp.errors.could_not_put, { "path": putPath }, ph.error(err));
			resolve(false);
		} finally {
			// noinspection JSUnresolvedVariable
			ftpClient.client.end();
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
			// noinspection JSUnresolvedVariable
			ftpClient.client.end();

			console.log(addPh(keys.api.ftp.success.connect.console, { "protocol": credentials.protocol }));
			return true;
		}
	});
}

function list(folder, credentials, message = defaultMessage) {
	return new Promise(async resolve => {
		const ftpData = await getData(credentials, message);
		if (!ftpData) return resolve(false);

		if (ftpData.protocol === 'plugin') return resolve(await plugin.list(folder, credentials, message));

		const ftpClient = await getFtpClient(ftpData, message);
		if (!ftpClient) return resolve(false);

		try {
			const list = await ftpClient.list(folder);

			resolve(list.map(item => {
				return {
					isDirectory: item.isDirectory(),
					name: item.getName(),
				}
			}));
		} catch(err) {
			resolve(false);
		} finally {
			// noinspection JSUnresolvedVariable
			ftpClient.client.end();
		}
	});
}

function find(file, start, maxDepth, credentials, message = defaultMessage) {
	return new Promise(async resolve => {
		const ftpClient = await getFtpClient(credentials, message);
		if (!ftpClient) return resolve(false);

		const foundFile = await findFile(ftpClient, file, start, maxDepth);
		// noinspection JSUnresolvedVariable
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
	if(typeof credentials !== 'object') credentials = await getData(credentials);

	try {
		if(credentials.protocol === 'ftp')
			return await ftp.create(credentials.host, credentials.port, credentials.user, credentials.password);
		else if(credentials.protocol === 'sftp')
			return await sftp.create(credentials.host, credentials.port, credentials.user, credentials.password);
	} catch(err) {
		message.respond(keys.api.ftp.errors.could_not_connect, { "protocol": credentials.protocol });
		return false;
	}
}

async function getData(credentials, message) {
	if(typeof credentials === 'string')
		return await utils.getServerData(credentials, message);
	else if(typeof credentials === 'object') return credentials;
	else return false;
}

module.exports = { get, put, connect, find, list };