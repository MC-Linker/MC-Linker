const Ftp = require('ftp');
const BaseClient = require('./BaseClient');
const fs = require('fs-extra');

class FtpClient extends BaseClient {

    constructor(credentials) {
        super(credentials);
        this.credentials.user = this.credentials.username;

        /**
         * The ftp client.
         * @type {import('ftp')}
         */
        this.client = new Ftp();
    }

    connect() {
        return new Promise(resolve => {
            this.client.on('ready', () => resolve(true));
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    find(name, start, maxDepth) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                return resolve(this._findFile(name, start, maxDepth));
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    get(source, destination) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                this.client.get(source, (err, stream) => {
                    if (err) return resolve(false);

                    stream.once('close', () => {
                        this.client.end();
                        resolve(true);
                    });
                    stream.pipe(fs.createWriteStream(destination));
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
                    resolve(listing.map(item => { return { name: item.name, isDirectory: item.type === 'd' } }));
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
                    resolve(true);
                });
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }

    _findFile(name, path, maxDepth) {
        return new Promise(resolve => {
            this.client.on('ready', () => {
                this.client.list(path, (err, listing) => {
                    if (err) return resolve(undefined);
                    for(const item of listing) {
                        if(item.type !== 'd' && item.name === name) return path;
                        else if(item.type === 'd') {
                            return resolve(this._findFile(name, `${path}/${item.name}`, maxDepth));
                        }
                    }
                });
            });
            this.client.on('error', () => resolve(false));

            this.client.connect(this.credentials);
        });
    }
}

module.exports = FtpClient;