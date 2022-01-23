
const fs = require('fs');
const nslookup = require('nslookup');
const { SlashCommandBuilder } = require('@discordjs/builders');
const utils = require('../../api/utils.js');
const Discord = require('discord.js');
const sftp = require('../../api/sftp');
const ftp = require('../../api/ftp');
const plugin = require('../../api/plugin');
const { pluginPort } = require('../../config.json');

module.exports = {
    name: 'connect',
    aliases: [],
    usage: 'connect ftp/plugin/user <options> <...>',
    example: '/connect account Lianecx **//**\n/connect plugin serverIp **//**\n/connect ftp host username password port 1.17',
    description: 'Connect your minecraft java-edition server or minecraft java-edition account with your bot. Connection methods are:\n-ftp (also includes sftp)\n-plugin\n-account\n**You can download the plugin using [this link](https://www.spigotmc.org/resources/smp-plugin.98749/).**',
    data: new SlashCommandBuilder()
            .setName('connect')
            .setDescription('Connect your minecraft server or account with the bot.')
            .addSubcommand(subcommand =>
                subcommand.setName('ftp')
                .setDescription('Connect your Minecraft server using ftp/sftp.')
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
                    .setDescription('Set the Minecraft version.')
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
                    .addChoice('1.18', '18')
                ).addStringOption(option =>
                    option.setName('path')
                    .setDescription('Set the world-path. (Format: /path/to/world)')
                    .setRequired(false)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('plugin')
                .setDescription('Connect your Minecraft server using the official plugin.')
                .addStringOption(option =>
					option.setName('ip')
					.setDescription('Set the server-ip.')
					.setRequired(true)
				).addIntegerOption(option =>
                    option.setName('port')
                    .setDescription('Set the port of the plugin from the config.yml')
                    .setRequired(false)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('account')
                .setDescription('Connect your Minecraft java-edition account with the bot.')
                .addStringOption(option =>
                    option.setName('username')
                    .setDescription('Set your Minecraft java-edition username.')
                    .setRequired(true)
                )
            ),
    async execute(message, args) {
        const method = args[0];

        if(!method) {
            console.log(`${message.member.user.tag} executed /connect without method in ${message.guild.name}`);
            message.reply(':warning: Please specify a method (`ftp`, `account`, `plugin`).');
            return;
        } else if(method !== 'account' && !message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            console.log(`${message.member.user.tag} executed /connect ${method} without admin in ${message.guild.name}`);
            message.reply(':no_entry: This command can only be executed by admins.');
            return;
        }

        if(method === 'ftp') {
            const host = args[1];
            let user = args[2];
            let password = args[3];
            const port = args[4];
            const version = args[5];
            let path = args[6];

            if (!host || !user || !password || !port) {
                console.log(`${message.member.user.tag} executed /connect ftp without credentials in ${message.guild.name}`);
                message.reply(':warning: Missing ftp credentials! Please check `/help connect` for correct usage!');
                return;
            } else if(!version) {
                console.log(`${message.member.user.tag} executed /connect ftp without version in ${message.guild.name}`);
                message.reply(':warning: Please specify the minecraft version.');
                return;
            }
            if(user === 'none') user = '';
            if(password === 'none') password = '';

            console.log(`${message.member.user.tag} executed /connect ftp ${host} ${user} ${password} ${port} ${version} ${path} in ${message.guild.name}`);

            if (version.split('.').pop() <= 11) message.reply(':warning: The advancement command might not work because advancements dont exist in your minecraft version yet.');
            else if (version.split('.').pop() <= 7) message.reply(':warning: The stat and advancement commands might not work because stats and advancements dont exist in your minecraft version yet.');

            message.reply('Connecting... (Can take up to one minute)');
            message.channel.sendTyping().catch(() => {});

            const connectFtp = await ftp.connect({
                host: host,
                pass: password,
                user: user,
                port: port
            });

            if(connectFtp !== true) {
                message.channel.sendTyping().catch(() => {});

                const connectSftp = await sftp.connect({
                    host: host,
                    pass: password,
                    user: user,
                    port: port,
                });

                if (connectSftp !== true) {
                    console.log('Couldn\'t connect with ftp or sftp.');
                    message.reply('<:Error:849215023264169985> Couldn\'t connect to server with ftp or sftp. Please check your credentials and try again.');
                    return;
                }

                if(!path) {
                    console.log('Searching for level.dat...');
                    message.reply('<:Checkmark:849224496232660992> Successfully connected with the sftp server. Finding world folder... (Can take up to one minute)');
                    path = await sftp.find('level.dat', '', 3, {
                        host: host,
                        pass: password,
                        user: user,
                        port: port,
                    });
                    if(!path) {
                        console.log('Could not find sftp worldPath.');
                        message.reply('<:Error:849215023264169985> Could not find world folder. Please specify the world path manually.');
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

                fs.writeFile(`./connections/servers/${message.guild.id}.json`, JSON.stringify(jsonSftp, null, 2), 'utf-8', err => {
                    if (err) {
                        console.log('Error writing sftpFile', err);
                        message.reply('<:Error:849215023264169985> Could not save credentials. Please try again.');
                        return;
                    }
                    console.log('Successfully wrote sftpFile');
                    message.reply('<:Checkmark:849224496232660992> Done! Successfully connected to the sftp server.');
                });
            } else {
                if(!path) {
                    console.log('Searching for level.dat...');
                    message.reply('<:Checkmark:849224496232660992> Successfully connected with the ftp server. Finding world folder (Can take up to one minute)...');
                    path = await ftp.find('level.dat', '', 3, {
                        host: host,
                        pass: password,
                        user: user,
                        port: port,
                    });
                    if(!path) {
                        console.log('Could not find ftp worldPath.');
                        message.reply('<:Error:849215023264169985> Could not find world folder. Please specify world path manually.');
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

                fs.writeFile(`./connections/servers/${message.guild.id}.json`, JSON.stringify(jsonFtp, null, 2), 'utf-8', err => {
                    if (err) {
                        console.log('Error writing ftpFile', err);
                        message.reply('<:Error:849215023264169985> Could not save credentials. Please try again.');
                        return;
                    }
                    console.log('Successfully wrote ftpFile');
                    message.reply('<:Checkmark:849224496232660992> Done! Successfully connected to the ftp server.');
                });
            }


        } else if(method === 'plugin') {
            let ip = args[1]?.split(':').shift();
            const port = args[2] ?? pluginPort;

            if(!ip) {
                console.log(`${message.member.user.tag} executed /connect plugin without ip in ${message.guild.name}`);
				message.reply(':warning: Please specify the server ip.');
				return;
            }

            console.log(`${message.member.user.tag} executed /connect plugin ${ip} ${port} in ${message.guild.name}`);

            nslookup(ip,async (err, address) => {
                ip = address?.pop() ?? ip;

                const verify = await plugin.verify(`${ip}:${port}`, message);
                if(!verify) return;

                message.reply('<:redsuccess:885601791465640016> Please check your DMs to complete the connection.');

                const verifyEmbed = new Discord.MessageEmbed()
                    .setTitle('Code Verification')
                    .setDescription('Please check the console of your minecraft server and enter the verification code from the server console below this message.\n**You have 3 minutes to reply.**')
                    .setColor('DARK_GOLD');

                let dmChannel = await message.member.user.createDM();
                dmChannel.send({ embeds: [verifyEmbed] })
                    .then(() => verifyAndConnect(dmChannel))
                    .catch(async () => {
                        message.reply(':warning: Couldn\'t send you a DM. Verifying in the current channel...');
                        await message.channel.send({ embeds: [verifyEmbed] });
                        verifyAndConnect(message.channel);
                    });

                async function verifyAndConnect(channel) {
                    try {
                        const collector = await channel.awaitMessages({ maxProcessed: 1, time: 180000, errors: ['time'] });

                        if(!collector.first()) {
                            console.log('Verification unsuccessful');
                            channel.send(':warning: You didn\'t reply in time!');
                            return;
                        }

                        const connectPlugin = await plugin.connect(`${ip}:${port}`, message.guildId, collector.first(), message);
                        if(!connectPlugin) return channel.send('<:Error:849215023264169985> Could not connect.');

                        else if(connectPlugin === 401) return channel.send(':warning: You didn\'t reply with the correct code!');
                        else channel.send('<:Checkmark:849224496232660992> Successfully verified!');

                        const pluginJson = {
                            "ip": connectPlugin.ip,
                            "version": connectPlugin.version.split('.')[1],
                            "path": decodeURIComponent(connectPlugin.path),
                            "hash": connectPlugin.hash,
                            "guild": connectPlugin.guild,
                            "chat": false,
                            "protocol": "plugin"
                        }

                        fs.writeFile(`./connections/servers/${message.guildId}.json`, JSON.stringify(pluginJson, null, 2), 'utf-8', err => {
                            if (err) {
                                console.log('Error writing pluginFile', err)
                                message.reply('<:Error:849215023264169985> Couldn\'t save IP. Please try again.');
                                return;
                            }
                            console.log('Successfully connected');
                            message.reply('<:Checkmark:849224496232660992> Successfully connected to the plugin.');
                        });
                    } catch(collected) {
                        console.log();
                        channel.send(':warning: You didn\'t reply in time!');
                    }
                }
            });


        } else if(method === 'account') {
            const mcUsername = args[1];

            if(!mcUsername) {
                console.log(`${message.member.user.tag} executed /connect account without username in ${message.guild.name}`);
                message.reply(':warning: Please specify your minecraft java-edition account name.');
                return;
            } else if(message.mentions.users.size) {
                console.log(`${message.member.user.tag} executed /connect account with ping in ${message.guild.name}`);
                message.reply(':warning: Don\'t ping someone. Specify your **minecraft java-edition account name**.');
                return;
            }

            console.log(`${message.member.user.tag} executed /connect account ${mcUsername} in ${message.guild.name}`);

            let uuidv4 = await utils.getUUIDv4(mcUsername, undefined, message);
            if(!uuidv4) return;

            const connectionJson = {
                'id': uuidv4,
                'name': mcUsername
            }

            fs.writeFile(`./connections/users/${message.member.user.id}.json`, JSON.stringify(connectionJson, null, 2), 'utf-8', err => {
                if (err) {
                    console.log('Error writing connection file', err);
                    message.reply('<:Error:849215023264169985> Could not save username. Please try again.');
                    return;
                }
                console.log(`Successfully wrote connection file with id ${uuidv4} and name: ${mcUsername}`);
                message.reply(`<:Checkmark:849224496232660992> Connected with Minecraft username: **${mcUsername}** and UUID: **${uuidv4}**`);
            });
        } else {
            console.log(`${message.member.user.tag} executed /connect with wrong method: ${method}`);
            message.channel.send(`:warning: [**${args[0]}**] is not a valid connection method.`);
        }
    }
}