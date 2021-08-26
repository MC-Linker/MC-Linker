module.exports = {
    name: 'ftp',
    aliases: ['ftpconnect', 'connectftp', 'server', 'connectserver', 'serverconnect'],
    usage: 'ftp <host> <username (`none` if no username)> <password (`none` if no password)> <port> <minecraft-version> <**Optional:** path to world folder (Format: /path/path)> **//** ftp disconnect',
    example: 'ftp someHost/ip lianecx supersecretpassword 21 1.17 **//** ftp localhost none none 21 1.17 path/to/world',
    description: "Connect or disconnect your minecraft Server with the bot. Can only be used by **admins**. \n**Need help getting the ftp credentials?**\n=> Join the [Support Server](https://discord.gg/rX36kZUGNK).",
    async execute(message, args) {
        const ftp = require('../../ftp');
        const Client = require('ftp');
        const SClient = require('ssh2-sftp-client');
        const sftp = require('../../sftp');
        const fs = require('fs');
        const util = require('util');
        const Discord = require('discord.js');

        let host = (args[0]);
        let user = (args[1]);
        let password = (args[2]);
        let port = parseInt(args[3]);
        let version = (args[4]);
        let path = (args[5]);

        if(host === 'disconnect' && !user) {
            if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
                message.reply(':no_entry: You are not an Admin!');
                console.log(message.member.user.tag + ' executed ^ftp disconnect without admin in ' + message.guild.name);
                return;
            }

            console.log(message.member.user.tag + ' executed ^ftp disconnect in ' + message.guild.name);

            fs.unlink(`./ftp/${message.guild.id}.json`, err => {
                if(err) {
                    console.log('Error trying to delete connection-file.', err);
                    message.reply(':warning: Couldnt disconnect the server. The server is most likely **not connected**.');
                    return;
                }
                console.log('Successfully disconnected ' + message.guild.name + '.');
                message.reply('<:Checkmark:849224496232660992> The connection between the server and this bot was successfully disconnected.');
            })
            return;
        } else if (!host || !user || !password || !port || !version) {
            console.log(message.member.user.tag + ' executed ^ftp wrong in ' + message.guild.name);
            message.reply(':warning: Incorrect Usage! Please check `^help ftp` for correct usage!');
            return;
        }

        console.log(message.member.user.tag + ` executed ^ftp ${host} ${user} ${password} ${port} ${version} ${path} in ` + message.guild.name);

        if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            message.reply(':no_entry: ' + "You are not an Admin!");
            console.log(message.member.user.tag + ' executed ^ftp without admin in ' + message.guild.name);
            return;
        } else if (version.startsWith('1.11') || version.startsWith('1.10') || version.startsWith('1.9') || version.startsWith('1.8') || version.startsWith('1.7')) {
            message.reply(':warning: The advancement command might not work because advancements dont exist in your Minecraft version yet.');
        } else if (!version.startsWith('1.13') && !version.startsWith('1.14') && !version.startsWith('1.15') && !version.startsWith('1.16') && !version.startsWith('1.17')) {
            message.reply(':warning: The stat and advancement commands might not work because your version isnt compatible with it.');
        }

        message.channel.sendTyping();

        if(user === 'none') user = '';
        if(password === 'none') password = '';

        const connectSftp = await sftp.connect({
            host: host,
            pass: password,
            user: user,
            port: port
        });

        if (connectSftp === false) {
            message.channel.sendTyping();
            
            const connectFtp = await ftp.connect({
                host: host,
                pass: password,
                user: user,
                port: port
            });

            if (connectFtp !== true) {
                console.log('Couldnt connect with sftp or ftp.');
                message.reply('<:Error:849215023264169985> Couldnt connect to server with ftp or sftp. Please check your credentials and try again.');
                return;
            }

            if(!path) {
                async function findFile(file, path, depth) {
                    if (path.split('/').length >= depth + 1) return undefined;
    
                    const list = await util.promisify(c.list).call(c, path);
                    console.log('List of [' + path + '] successful.');
    
                    for (const item of list) {
                        if (item.type === '-' && item.name === file) return path;
                        else if (typeof item === 'string' && item.startsWith('-') && item.split(' ').pop() === file) return path;
                        else if(typeof item === 'string' && item.startsWith('d')) {
                            let res = await findFile(file, `${path}/${item.split(' ').pop()}`, depth);
                            if (res === undefined) continue;
                            else return res;
                            
                        } else if (item.type === 'd') {
                            let res = await findFile(file, `${path}/${item.name}`, depth);
                            if (res === undefined) continue;
                            else return res;
                        }
                    }
                }

                const c = new Client();
                c.connect({
                    host: host,
                    user: user,
                    password: password,
                    port: port
                });

                c.on('error', function(err) {
                    console.log('Could not find ftp worldPath.', err);
                    message.reply('<:Error:849215023264169985> Error trying to find world folder. Please pass in the world path manually as last argument.')
                    return;
                });

                c.on('ready', async () => {
                    console.log('Searching for level.dat...');
                    message.reply('<:Checkmark:849224496232660992> Succesfully connected with the ftp server. Finding world folder (Can take up to one minute)...');
                    let worldPath = await findFile('level.dat', '', 4);
                    c.end();

                    if (worldPath) {
                        console.log(`Found worldPath: ${worldPath}.`);
                        message.reply('<:Checkmark:849224496232660992> Found world folder [**' + worldPath + '**]. If this is not correct, type in the world path manually as last argument.\nFinalizing...');
                        path = worldPath;
                    } else {
                        console.log('Couldnt find worldPath');
                        message.reply('<:Error:849215023264169985> Couldnt find world folder. Please type in the world path manually as last argument.');
                        return;
                    }

                    const jsonFtp = {
                        "host": host,
                        "user": user,
                        "password": password,
                        "port": port,
                        "path": path,
                        "version": version,
                        "protocol": 'ftp'
                    }

                    fs.writeFile('./ftp/' + message.guild.id + '.json', JSON.stringify(jsonFtp, null, 2), err => {
                        if (err) {
                            console.log('Error writing ftpFile', err);
                            message.reply('<:Error:849215023264169985> Error trying to connect to the ftp server.');
                        } else {
                            console.log('Successfully wrote ftpFile');
                            message.reply('<:Checkmark:849224496232660992> Done! Successfully connected to the ftp server.');
                        }
                    })
                });
            } else {
                const jsonFtp = {
                    "host": host,
                    "user": user,
                    "password": password,
                    "port": port,
                    "path": path,
                    "version": version,
                    "protocol": 'ftp'
                }

                fs.writeFile('./ftp/' + message.guild.id + '.json', JSON.stringify(jsonFtp, null, 2), err => {
                    if (err) {
                        console.log('Error writing ftpFile', err);
                        message.reply('<:Error:849215023264169985> Error trying to connect to the ftp server.');
                    } else {
                        console.log('Successfully wrote ftpFile');
                        message.reply('<:Checkmark:849224496232660992> Successfully connected with the ftp server.');
                    }
                })
            }

        } else if (connectSftp === true) {
            if(!path) {
                async function findFile(file, path, depth) {
                    if (path.split('/').length >= depth + 1) return undefined;
    
                    const list = await c.list(path);
                    console.log('List of [' + path + '] successful.');
    
                    for (const item of list) {
                        if (item.type === '-' && item.name === file) return path;
                        else if (item.type === 'd') {
                            let res = await findFile(file, `${path}/${item.name}`, depth);
                            if (res === undefined) continue;
                            else return res;
                        }
                    }
                }

                const c = new SClient();
                try {
                    await c.connect({
                        host: host,
                        username: user,
                        password: password,
                        port: port
                    });

                    console.log('Searching for level.dat...');
                    message.reply('<:Checkmark:849224496232660992> Succesfully connected with the sftp server. Finding world folder (Can take up to one minute)...');
                    let worldPath = await findFile('level.dat', '', 4);
                    c.end();

                    if (worldPath) {
                        console.log(`Found worldPath: ${worldPath}.`);
                        message.reply('<:Checkmark:849224496232660992> Found world folder [**' + worldPath + '**]. If this is not correct, type in the world path manually as last argument.\nFinalizing...');
                        path = worldPath;
                    } else {
                        console.log('Couldnt find worldPath');
                        message.reply('<:Error:849215023264169985> Couldnt find world folder. Please type in the world path manually as last argument.');
                        return;
                    }

                    const jsonFtp = {
                        "host": host,
                        "user": user,
                        "password": password,
                        "port": port,
                        "path": path,
                        "version": version,
                        "protocol": 'ftp'
                    }

                    fs.writeFile('./ftp/' + message.guild.id + '.json', JSON.stringify(jsonFtp, null, 2), err => {
                        if (err) {
                            console.log('Error writing ftpFile', err);
                            message.reply('<:Error:849215023264169985> Error trying to connect to the ftp server.');
                        } else {
                            console.log('Successfully wrote ftpFile');
                            message.reply('<:Checkmark:849224496232660992> Done! Successfully connected to the ftp server.');
                        }
                    });
                } catch (err) {
                    console.log('Could not find sftp worldPath.', err);
                    message.reply('<:Error:849215023264169985> Error trying to find world folder. Please pass in the world path manually as last argument.');
                    return;
                }
            } else {
                const jsonFtp = {
                    "host": host,
                    "user": user,
                    "password": password,
                    "port": port,
                    "path": path,
                    "version": version,
                    "protocol": 'sftp'
                }

                fs.writeFile('./ftp/' + message.guild.id + '.json', JSON.stringify(jsonFtp, null, 2), err => {
                    if (err) {
                        console.log('Error writing ftpFile', err);
                        message.reply('<:Error:849215023264169985> Error trying to connect with the sftp server.');
                    } else {
                        console.log('Successfully wrote ftpFile');
                        message.reply('<:Checkmark:849224496232660992> Succesfully connected with server.');
                    }
                })
            }
        } else {
            console.log('Couldnt connect to server.');
            message.reply('<:Error:849215023264169985> Couldnt connect to server.');
            return;
        }
    }
}