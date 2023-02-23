import Sftp from 'ssh2-sftp-client';
import BaseClient from './BaseClient.js';
import fs from 'fs-extra';

export default class SftpClient extends BaseClient {

    constructor(credentials) {
        super(credentials);
        this.credentials.host ??= credentials.ip;

        delete this.credentials.user;
        delete this.credentials.ip;

        /**
         * The sftp client.
         * @type {import('ssh2-sftp-client')}
         */
        this.client = new Sftp();
    }

    async connect() {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                this.client.end();
                reject(new Error('Connection timed out.'));
            }, 10000);

            await this.client.connect(this.credentials);
            clearTimeout(timeout);
            resolve(true);
        });
    }

    async find(name, start, maxDepth) {
        return await this._findFile(name, start, maxDepth);
    }

    async get(source, destination) {
        await fs.ensureFile(destination);
        await this.client.get(source, destination, {});
        return true;
    }

    async list(folder) {
        const listing = await this.client.list(folder, () => {});
        return listing.map(item => {
            return { name: item.name, isDirectory: item.type === 'd' };
        });
    }

    async put(source, destination) {
        await this.client.put(source, destination, {});
        return true;
    }

    async disconnect() {
        await this.client.end();
        return true;
    }

    async _findFile(name, path, maxDepth) {
        return new Promise(async resolve => {
            if(path.split('/').length - 1 >= maxDepth) return resolve(undefined);

            const listing = await this.client.list(path, () => {});
            const foundFile = listing.find(item => item.name === name && item.type === '-');
            if(foundFile) return resolve(path);

            for(const item of listing) {
                if(item.type === 'd') {
                    return resolve(await this._findFile(name, `${path}/${item.name}`, maxDepth));
                }
            }
            resolve(undefined);
        });
    }
}
