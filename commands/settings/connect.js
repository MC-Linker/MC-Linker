const fs = require('fs-extra');
const dns = require('dns/promises');
const utils = require('../../api/utils.js');
const Discord = require('discord.js');
const sftp = require('../../api/sftp');
const ftp = require('../../api/ftp');
const plugin = require('../../api/plugin');
const { pluginPort } = require('../../config.json');
const { keys, ph, addPh, getEmbedBuilder } = require('../../api/messages');

async function execute(message, args) {
    const method = args[0];

    if(!method) {
        message.respond(keys.commands.connect.warnings.no_method);
        return;
    } else if(method !== 'account' && !message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.connect.warnings.no_permission);
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
            message.respond(keys.commands.connect.warnings.no_credentials);
            return;
        } else if(!version) {
            message.respond(keys.commands.connect.warnings.no_version);
            return;
        } else if(port <= 0 || port > 65536) {
            message.respond(keys.commands.connect.warnings.invalid_port);
            return;
        }

        if(user === 'none') user = '';
        if(password === 'none') password = '';

        if (version.split('.').pop() <= 11 && version.split('.').pop() > 7) message.channel.send(addPh(keys.commands.connect.warnings.version_below_11, ph.fromStd(message)));
        else if (version.split('.').pop() <= 7) message.channel.send(addPh(keys.commands.connect.warnings.version_below_7, ph.fromStd(message)));

        message.respond(keys.commands.connect.warnings.connecting);

        let ftpData = {};

        //Try ftp
        const connectFtp = await ftp.connect({
            host: host,
            pass: password,
            user: user,
            port: port
        });

        //Could not connect with ftp
        if(connectFtp !== true) {
            //Try sftp
            const connectSftp = await sftp.connect({
                host: host,
                pass: password,
                user: user,
                port: port,
            });

            //Could not connect with sftp
            if (connectSftp !== true) {
                message.respond(keys.commands.connect.errors.could_not_connect_ftp);
                return;
            }

            //Connected with sftp

            if(!path) {
                message.respond(keys.commands.connect.warnings.searching_level);
                path = await sftp.find('level.dat', '', 3, {
                    host: host,
                    pass: password,
                    user: user,
                    port: port,
                });
                if(!path) {
                    message.respond(keys.commands.connect.errors.could_not_find_level);
                    return;
                }
            }

            ftpData = {
                "host": host,
                "user": user,
                "password": password,
                "port": port,
                "path": path,
                "version": version,
                "protocol": 'sftp'
            }
        } else {
            //Connected with ftp

            if(!path) {
                message.respond(keys.commands.connect.warnings.searching_level);
                path = await ftp.find('level.dat', '', 3, {
                    host: host,
                    pass: password,
                    user: user,
                    port: port,
                });
                if(!path) {
                    message.respond(keys.commands.connect.errors.could_not_find_level);
                    return;
                }
            }

            ftpData = {
                "host": host,
                "user": user,
                "password": password,
                "port": port,
                "path": path,
                "version": version,
                "protocol": 'ftp'
            }
        }

        //Connected with either ftp or sftp
        //Save connection
        fs.outputJson(`./serverdata/connections/${message.guildId}/connection.json`, ftpData, { spaces: 2 }, err => {
            if (err) {
                message.respond(keys.commands.connect.errors.could_not_write_server_file);
                return;
            }

            message.respond(keys.commands.connect.success.ftp);
        });


    } else if(method === 'plugin') {
        let ip = args[1]?.split(':').shift();
        const port = args[2] ?? pluginPort;

        if(!ip) {
            message.respond(keys.commands.connect.warnings.no_ip);
            return;
        }

        try {
            //Lookup ip of dns
            const { address } = await dns.lookup(ip, 4);
            if(address) ip = address;
        } catch(ignored) {}

        const verify = await plugin.verify(`${ip}:${port}`, message);
        if(!verify) return;

        message.respond(keys.commands.connect.warnings.check_dms);

        const verifyEmbed = getEmbedBuilder(keys.commands.connect.warnings.verification, ph.fromStd(message));

        let dmChannel = await message.member.user.createDM();
        try {
            await dmChannel.send({ embeds: [verifyEmbed] });
        } catch(err) {
            dmChannel = message.channel;
            message.respond(keys.commands.connect.warnings.could_not_dm);
            await dmChannel.send({ embeds: [verifyEmbed] });
        }

        const collector = await dmChannel.awaitMessages({ maxProcessed: 1, time: 180000, errors: ['time'] });

        if(!collector.first()) {
            console.log(keys.commands.connect.warnings.no_reply_in_time.console);
            const noReplyEmbed = getEmbedBuilder(keys.commands.connect.warnings.no_reply_in_time, ph.fromStd(message));
            dmChannel.send({ embeds: [noReplyEmbed] });
            return;
        }

        const connectPlugin = await plugin.connect(`${ip}:${port}`, message.guildId, collector.first(), message);
        if(!connectPlugin) {
            const noConnectionEmbed = getEmbedBuilder(keys.commands.connect.errors.could_not_connect_plugin, ph.fromStd(message));
            dmChannel.send({ embeds: [noConnectionEmbed] });
            return;
        }

        else if(connectPlugin === 401) {
            const incorrectCodeEmbed = getEmbedBuilder(keys.commands.connect.errors.incorrect_code, ph.fromStd(message));
            dmChannel.send({ embeds: [incorrectCodeEmbed] });
            return;
        } else {
            const verificationEmbed = getEmbedBuilder(keys.commands.connect.success.verification, ph.fromStd(message));
            dmChannel.send({ embeds: [verificationEmbed] });
        }

        const pluginJson = {
            "ip": connectPlugin.ip,
            "version": connectPlugin.version.split('.')[1],
            "path": decodeURIComponent(connectPlugin.path),
            "hash": connectPlugin.hash,
            "guild": connectPlugin.guild,
            "chat": false,
            "protocol": "plugin"
        };

        fs.outputJson(`./serverdata/connections/${message.guildId}/connection.json`, pluginJson, { spaces: 2 }, err => {
            if (err) {
                message.respond(keys.commands.connect.errors.could_not_write_server_file);
                return;
            }

            message.respond(keys.commands.connect.success.plugin);
        });

    } else if(method === 'account') {
        const mcUsername = args[1];

        if(!mcUsername) {
            message.respond(keys.commands.connect.warnings.no_username);
            return;
        } else if(message.mentions.users.size) {
            message.respond(keys.commands.connect.warnings.user_pinged);
            return;
        }

        let uuidv4 = await utils.getUUIDv4(mcUsername, message);
        if(!uuidv4) return;

        const connectionJson = {
            'id': uuidv4,
            'name': mcUsername
        };

       fs.outputJson(`./userdata/connections/${message.member.user.id}/connection.json`, connectionJson, 'utf-8', err => {
            if (err) {
                message.respond(keys.commands.connect.errors.could_not_write_user_file);
                return;
            }

           message.respond(keys.commands.connect.success.account, { "username": mcUsername, "uuid": uuidv4 });
        });
    } else {
        message.respond(keys.commands.connect.warnings.invalid_method);
    }
}

module.exports = { execute };