const Ftp = require('promise-ftp');
const BaseClient = require('./BaseClient');
const fs = require('fs-extra');

class FtpClient extends BaseClient {

    constructor(credentials) {
        super(credentials);
        this.credentials.user ??= credentials.username;
        this.credentials.host ??= credentials.ip;

        delete this.credentials.ip;
        delete this.credentials.username;

        /**
         * The ftp client.
         * @type {import('promise-ftp')}
         */
        this.client = new Ftp();
    }

    async connect() {
        await this.client.connect(this.credentials);
        return true;
    }

    async find(name, start, maxDepth) {
        return await this._findFile(name, start, maxDepth);
    }

    async get(source, destination) {
        return new Promise(async (resolve, reject) => {
            await fs.ensureFile(destination);
            const stream = await this.client.get(source, destination);

            stream.once('close', () => resolve(true));
            stream.once('error', reject);
            stream.pipe(fs.createWriteStream(destination));
        });
    }

    async list(folder) {
        const listing = await this.client.list(folder);
        return listing.map(item => {
            return { name: item.name, isDirectory: item.type === 'd' };
        });
    }

    async put(source, destination) {
        await this.client.put(source, destination);
        return true;
    }

    async disconnect() {
        await this.client.end();
        return true;
    }

    _findFile(name, path, maxDepth) {
        return new Promise(async resolve => {
            const listing = await this.client.list(path);
            const foundFile = listing.find(item => item.name === name && item.type === '-');
            if(foundFile) return resolve(path);

            for(const item of listing) {
                if(item.type === 'd') {
                    const foundFile = this._findFile(name, `${path}/${item.name}`, maxDepth);
                    if(foundFile) return resolve(foundFile);
                }
            }
            resolve(null);
        });
    }
}

module.exports = FtpClient;