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
        return new Promise(resolve => {
            this.client.on('ready', () => {
                this.client.on('close', () => resolve(true));
                this.client.end();
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    find(name, start, maxDepth) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                const foundFile = this._findFile(name, start, maxDepth);
                this.client.on('close', () => resolve(foundFile));
                this.client.end();
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    get(source, destination) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                fs.ensureFile(destination, err => {
                    if(err) return resolve(false);

                    this.client.get(source, (err, stream) => {
                        if (err) return resolve(false);

                        stream.once('close', () => {
                            this.client.on('close', () => resolve(true));
                            this.client.end();
                        });
                        stream.pipe(fs.createWriteStream(destination));
                    });
                });
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    list(folder) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                this.client.list(folder, (err, listing) => {
                    if (err) return resolve(false);
                    this.client.on('close', () => resolve(listing.map(item => { return { name: item.name, isDirectory: item.type === 'd' } })));
                    this.client.end();
                });
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    put(source, destination) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                this.client.put(source, destination, err => {
                    if (err) return resolve(false);
                    this.client.on('close', () => resolve(true));
                    this.client.end();
                    resolve(true);
                });
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    _findFile(name, path, maxDepth) {
        return new Promise(resolve => {
            this.client.list(path, (err, listing) => {
                if (err) return resolve(undefined);

                for(const item of listing) {
                    if(item.type !== 'd' && item.name === name) return path;
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