
const fs = require('fs');
const nslookup = require('nslookup');
const utils = require('../../utils.js');
const Discord = require('discord.js');
const sftp = require('../../api/sftp');
const ftp = require('../../api/ftp');
const plugin = require('../../api/plugin');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'connect',
    aliases: [],
    usage: 'connect ftp/rcon/plugin/user <options> <...>',
    example: '/connect user Lianecx **//**\n/connect plugin serverIp **//**\n/connect ftp host username password port 1.17 **//**\n/connect rcon serverip rcon-password rcon-port',
    description: 'Connect your minecraft java edition server or minecraft account with your bot. Connection methods are:\n-ftp/sftp\n-rcon\n-plugin\n-user',
    data: new SlashCommandBuilder()
            .setName('connect')
            .setDescription('Connect your minecraft server ')
            .addSubcommand(subcommand =>
                subcommand.setName('ftp')
                .setDescription('Connect your Minecraft Server using ftp/sftp.')
                .addStringOption(option =>
                    option.setName('host')
                    .setDescription('Set the ftp-host.')
                    .setRequired(true)
                ).addStringOption(option =>
                    option.setName('username')
                    .setDescription('Set the ftp-username (`none` if no username).')
                    .setRequired(true)
                ).addStringOption(option =>
                    option.setName('password')
                    .setDescription('Set the ftp-password (`none` if no password).')
                    .setRequired(true)
                ).addNumberOption(option =>
                    option.setName('port')
                    .setDescription('Set the ftp-port.')
                    .setRequired(true)
                ).addStringOption(option =>
                    option.setName('version')
                    .setDescription('Set the minecraft-version.')
                    .setRequired(true)
                    .addChoice('1.5', '5')
                    .addChoice('1.6', '6')
                    .addChoice('1.7', '7')
                    .addChoice('1.8', '8')
                    .addChoice('1.9', '9')
                    .addChoice('1.10', '10')
                    .addChoice('1.11', '11')
                    .addChoice('1.12', '12')
                    .addChoice('1.13', '13')
                    .addChoice('1.14', '14')
                    .addChoice('1.15', '15')
                    .addChoice('1.16', '16')
                    .addChoice('1.17', '17')
                ).addStringOption(option =>
                    option.setName('path')
                    .setDescription('Set the world-path. (Format: /path/to/world)')
                    .setRequired(false)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('plugin')
                .setDescription('Connect your minecraft server using the official plugin.')
                .addStringOption(option =>
					option.setName('ip')
					.setDescription('Set the server-ip.')
					.setRequired(true)
				).addStringOption(option =>
                    option.setName('path')
                    .setDescription('Set the world-path. (Format: /path/to/world)')
                    .setRequired(false)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('user')
                .setDescription('Connect your minecraft java edition account with the bot.')
                .addStringOption(option =>
                    option.setName('username')
                    .setDescription('Set your minecraft java edition username.')
                    .setRequired(true)
                )
            ),
    async execute(message, args) {
        const mode = args[0];

        if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR && mode !== 'user')) {
            message.reply(':no_entry: This command can only be executed by admins.');
            console.log(message.member.user.tag + ' executed /connect ftp without admin in ' + message.guild.name);
            return;
        }

        if(mode === 'ftp') {
            const host = (args[1]);
            let user = (args[2]);
            let password = (args[3]);
            const port = (args[4]);
            const version = (args[5]);
            let path = (args[6]);

            if (!host || !user || !password || !port || !version) {
                console.log(message.member.user.tag + ' executed /connect ftp wrong in ' + message.guild.name);
                message.reply(':warning: Incorrect Usage! Please check `/help ftp` for correct usage!');
                return;
            }
            if(user === 'none') user = '';
            if(password === 'none') password = '';

            console.log(message.member.user.tag + ` executed /connect ftp ${host} ${user} ${password} ${port} ${version} ${path} in ` + message.guild.name);

            if (version.split('.').pop() <= 11) {
                message.reply(':warning: The advancement command might not work because advancements dont exist in your minecraft version yet.');
            } else if (version.split('.').pop() <= 7) {
                message.reply(':warning: The stat and advancement commands might not work because they dont exist in your minecraft version yet.');
            }
            message.channel.sendTyping();

            const connectFtp = await ftp.connect({
                host: host,
                pass: password,
                user: user,
                port: port
            });

            if(connectFtp !== true) {
                message.channel.sendTyping();

                const connectSftp = await sftp.connect({
                    host: host,
                    pass: password,
                    user: user,
                    port: port,
                });

                if (connectSftp !== true) {
                    console.log('Couldnt connect with ftp or sftp.');
                    message.reply('<:Error:849215023264169985> Couldnt connect to server with ftp or sftp. Please check your credentials and try again.');
                    return;
                }

                if(!path) {
                    console.log('Searching for level.dat...');
                    message.reply('<:Checkmark:849224496232660992> Succesfully connected with the sftp server. Finding world folder (Can take up to one minute)...');
                    path = await sftp.find('level.dat', '', 3, {
                        host: host,
                        pass: password,
                        user: user,
                        port: port,
                    });
                    if(!path) {
                        console.log('Could not find sftp worldPath.');
                        message.reply('<:Error:849215023264169985> Could not find world folder. Please pass in the world path manually as last argument.');
                        return;
                    }
                }

                const jsonSftp = {
                    "host": host,
                    "user": user,
                    "password": password,
                    "port": port,
                    "path": path,
                    "version": version,
                    "protocol": 'sftp'
                }

                fs.writeFile('./ftp/' + message.guild.id + '.json', JSON.stringify(jsonSftp, null, 2), 'utf-8', err => {
                    if (err) {
                        console.log('Error writing sftpFile', err);
                        message.reply('<:Error:849215023264169985> Error trying to write credentials. Please try again.');
                        return;
                    }
                    console.log('Successfully wrote sftpFile');
                    message.reply('<:Checkmark:849224496232660992> Done! Successfully connected to the sftp server.');
                });
            } else {
                if(!path) {
                    console.log('Searching for level.dat...');
                    message.reply('<:Checkmark:849224496232660992> Succesfully connected with the ftp server. Finding world folder (Can take up to one minute)...');
                    path = await ftp.find('level.dat', '', 3, {
                        host: host,
                        pass: password,
                        user: user,
                        port: port,
                    });
                    if(!path) {
                        console.log('Could not find ftp worldPath.');
                        message.reply('<:Error:849215023264169985> Could not find world folder. Please pass in the world path manually as last argument.');
                        return;
                    }
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

                fs.writeFile('./ftp/' + message.guild.id + '.json', JSON.stringify(jsonFtp, null, 2), 'utf-8', err => {
                    if (err) {
                        console.log('Error writing ftpFile', err);
                        message.reply('<:Error:849215023264169985> Error trying to write credentials. Please try again.');
                        return;
                    }
                    console.log('Successfully wrote ftpFile');
                    message.reply('<:Checkmark:849224496232660992> Done! Successfully connected to the ftp server.');
                });
            }


        } else if(mode === 'plugin') {
            let ip = args[1];
            if(!ip) {
                console.log(message.member.user.tag + ' executed /connect plugin without args in ' + message.guild.name);
				message.reply(':warning: Please specify the server ip. `/help rcon` for more help.');
				return;
            }
            console.log(message.member.user.tag + ` executed /connect plugin ${ip} in ` + message.guild.name);

            const connectPlugin = await plugin.connect(ip + ':21000', message.guildId, undefined, undefined, message);
            if(!connectPlugin) return;

            const pluginJson = {
                "ip": connectPlugin.ip + ':21000',
                "version": connectPlugin.version.split('.')[1],
                "path": connectPlugin.path,
                "hash": connectPlugin.hash,
                "guild": connectPlugin.guild,
                "chat": false,
                "protocol": "plugin"
            }

            fs.writeFile(`./ftp/${message.guildId}.json`, JSON.stringify(pluginJson, null, 2), 'utf-8', err => {
                if(err) {
                    console.log('Error writing pluginFile')
                    message.reply('<:Error:849215023264169985> Couldnt save IP. Please try again.');
                    return;
                }
                console.log('Successfully connected');
                message.reply('<:Checkmark:849224496232660992> Successfully connected to the plugin.');
            });

        } else if(mode === 'user') {
            const ingameName = args[1];

            if(!ingameName) {
                console.log(message.member.user.tag + ' executed /connect without args in ' + message.guild.name);
                message.reply(':warning: Please specify your minecraft-name.');
                return;
            } else if(message.mentions.users.size) {
                console.log(message.member.user.tag + ' executed connect with ping in ' + message.guild.name);
                message.reply(`<:Error:849215023264169985> Don't ping someone. Use your **minecraftname** as argument.`);
                return;
            }

            console.log(message.member.user.tag + ' executed /connect ' + ingameName + ' in ' + message.guild.name);

            let uuidv4 = await utils.getUUIDv4(ingameName, message);
            if(!uuidv4) return;

            const connectionJson = {
                'id': uuidv4,
                'name': ingameName
            }

            const connectionString = JSON.stringify(connectionJson, null, 2);

            fs.writeFile('./connections/' + message.member.user.id + '.json', connectionString, 'utf-8', err => {
                if (err) {
                    message.reply('<:Error:849215023264169985> Error trying to connect.');
                    console.log('Error writing conectionFile', err);
                    return;
                } else {
                    message.reply(`<:Checkmark:849224496232660992> Connected with Minecraft-username: **${ingameName}** and UUID: **${uuidv4}**`);
                    console.log('Successfully wrote connectionfile with id ' + uuidv4 + ' and name: ' + ingameName);
                }
            });
        } else {
            console.log(message.member.user.tag + ' executed /rcon with wrong argument: ' + args[0]);
            message.channel.send(`:warning: This [**${args[0]}**] is not a valid connection method.`);
        }
    }
}