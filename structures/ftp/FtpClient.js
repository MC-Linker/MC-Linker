const Ftp = require('ftp');
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
         * @type {import('ftp')}
         */
        this.client = new Ftp();
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.client.once('ready', () => {
                this.client.once('close', () => resolve(true));
                this.client.end();
            });
            this.client.once('error', reject);

            this.client.connect(this.credentials);
            setTimeout(() => {
                resolve(false);
                this.client.removeAllListeners();
                this.client.end();
            }, 15_000);
        });
    }

    find(name, start, maxDepth) {
        return new Promise((resolve, reject) => {
            this.client.once('ready', () => {
                const foundFile = this._findFile(name, start, maxDepth);
                this.client.once('close', () => resolve(foundFile));
                this.client.end();
            });
            this.client.once('error', reject);

            this.client.connect(this.credentials);
        });
    }

    get(source, destination) {
        return new Promise((resolve, reject) => {
            this.client.once('ready', () => {
                fs.ensureFile(destination, err => {
                    if(err) return reject(err);

                    this.client.get(source, (err, stream) => {
                        if(err) return reject(err);

                        stream.once('close', () => {
                            this.client.once('close', () => resolve(true));
                            this.client.end();
                        });
                        stream.once('error', reject);
                        stream.pipe(fs.createWriteStream(destination));
                    });
                });
            });
            this.client.once('error', err => { throw err });

            this.client.connect(this.credentials);
        });
    }

    list(folder) {
        return new Promise((resolve, reject) => {
            this.client.once('ready', () => {
                this.client.list(folder, (err, listing) => {
                    if(err) return reject(err);
                    this.client.once('close', () => resolve(listing.map(item => {
                        return {
                            name: item.name,
                            isDirectory: item.type === 'd',
                        };
                    })));
                    this.client.end();
                });
            });
            this.client.once('error', reject);

            this.client.connect(this.credentials);
        });
    }

    put(source, destination) {
        return new Promise((resolve, reject) => {
            this.client.once('ready', () => {
                this.client.put(source, destination, err => {
                    if(err) return reject(err);
                    this.client.once('close', () => resolve(true));
                    this.client.end();
                    resolve(true);
                });
            });
            this.client.once('error', reject);

            this.client.connect(this.credentials);
        });
    }

    _findFile(name, path, maxDepth) {
        return new Promise(resolve => {
            this.client.list(path, (err, listing) => {
                if(err) return resolve(undefined);

                const foundFile = listing.find(item => item.name === name && item.type === '-');
                if(foundFile) return resolve(path);

                for(const item of listing) {
                    if(item.type !== 'd' && item.name === name) return resolve(path);
                    else if(item.type === 'd') {
                        const foundFile = this._findFile(name, `${path}/${item.name}`, maxDepth);
                        if(foundFile) return resolve(foundFile);
                    }
                }
            });
        });
    }
}

module.exports = FtpClient;