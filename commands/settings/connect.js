const fs = require('fs-extra');
const dns = require('dns/promises');
const utils = require('../../api/utils.js');
const Discord = require('discord.js');
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
        const port = args[4] ?? 21;
        let version = args[5]?.split('.')?.pop() ?? 19;
        let path = args[6];

        version = parseInt(version);

        if (!host || !user || !password || !port) {
            message.respond(keys.commands.connect.warnings.no_credentials);
            return;
        } else if(isNaN(version)) {
            message.respond(keys.commands.connect.warnings.no_version);
            return;
        } else if(port <= 0 || port > 65536) {
            message.respond(keys.commands.connect.warnings.invalid_port);
            return;
        }

        if(user === 'none') user = '';
        if(password === 'none') password = '';

        //Send version warnings
        if (version <= 11 && version > 7) message.channel.send(addPh(keys.commands.connect.warnings.version_below_11, ph.fromStd(message)));
        else if (version <= 7) message.channel.send(addPh(keys.commands.connect.warnings.version_below_7, ph.fromStd(message)));

        message.respond(keys.commands.connect.warnings.connecting);

        //Automatically disconnect from plugin
        const ip = await utils.getIp(message.guildId);
        if(ip) {
            const disconnected = await plugin.disconnect(message.guildId, message.client);

            if(!disconnected) {
                const embed = getEmbedBuilder(keys.commands.connect.warnings.not_completely_disconnected, ph.emojis(), { "ip": ip });
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = getEmbedBuilder(keys.commands.connect.warnings.automatically_disconnected, ph.emojis(), { "ip": ip });
                message.channel.send({ embeds: [embed] });
            }
        }

        const protocol = await ftp.connect({ host, password, user, port });
        if(!protocol) {
            message.respond(keys.commands.connect.errors.could_not_connect_ftp);
            return;
        }

        //Search for server path if not given
        if(!path) {
            message.respond(keys.commands.connect.warnings.searching_properties);
            path = await ftp.find('server.properties', '', 2, { host, password, user, port, protocol });
            if(!path) {
                message.respond(keys.commands.connect.errors.could_not_find_properties);
                return;
            }
        }

        const serverProperties = await ftp.get(`${path}/server.properties`, `./serverdata/connections/${message.guildId}/server.properties`, { host, user, password, port, protocol });
        if(!serverProperties) {
            message.respond(keys.commands.connect.errors.could_not_get_properties);
            return;
        }
        const propertiesObject = Object.fromEntries(serverProperties.toString().split('\n').map(prop => prop.split('=')));

        const ftpData = {
            "host": host,
            "user": user,
            "password": password,
            "port": port,
            "online": propertiesObject['online-mode'] === 'true',
            "path": `${path}/${propertiesObject['level-name']}`,
            "version": version,
            "protocol": protocol,
        };

        //Connected with either ftp or sftp
        //Save connection
        fs.outputJson(`./serverdata/connections/${message.guildId}/connection.json`, ftpData, { spaces: 2 }, async err => {
            if (err) {
                message.respond(keys.commands.connect.errors.could_not_write_server_file);
                return;
            }

            await fs.outputJson(`./serverdata/connections/${message.guildId}/connection.json`, ftpData, { spaces: 2 });

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

        const collector = await dmChannel.awaitMessages({ maxProcessed: 1, time: 180_000, errors: ['time'] });

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
            "online": connectPlugin.online,
            "chat": false,
            "protocol": "plugin",
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

        let uuidv4 = await utils.getUUID(mcUsername, message.guildId,message);
        if(!uuidv4) return;

        const connectionJson = {
            'id': uuidv4,
            'name': mcUsername
        };

       fs.outputJson(`./userdata/connections/${message.member.user.id}/connection.json`, connectionJson, { spaces: 2 }, err => {
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