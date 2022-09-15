const fs = require('fs-extra');
const dns = require('dns/promises');
const Discord = require('discord.js');
const { pluginPort } = require('../../config.json');
const { keys, ph, addPh, getEmbed } = require('../../api/messages');
const Command = require('../../structures/Command');

class Connect extends Command {

    constructor() {
        super('connect');
    }

    async execute(interaction, client, args) {
        const method = args[0];

        if(!method) {
            interaction.replyTl(keys.commands.connect.warnings.no_method);
            return;
        }
        else if(method !== 'account' && !interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            interaction.replyTl(keys.commands.connect.warnings.no_permission);
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

            if(!host || !user || !password || !port) {
                interaction.replyTl(keys.commands.connect.warnings.no_credentials);
                return;
            }
            else if(isNaN(version)) {
                interaction.replyTl(keys.commands.connect.warnings.no_version);
                return;
            }
            else if(port <= 0 || port > 65536) {
                interaction.replyTl(keys.commands.connect.warnings.invalid_port);
                return;
            }

            if(user === 'none') user = '';
            if(password === 'none') password = '';

            //Send version warnings
            if(version <= 11 && version > 7) interaction.channel.send(addPh(keys.commands.connect.warnings.version_below_11, ph.std(interaction)));
            else if(version <= 7) interaction.channel.send(addPh(keys.commands.connect.warnings.version_below_7, ph.std(interaction)));

            interaction.replyTl(keys.commands.connect.warnings.connecting);

            //Automatically disconnect from plugin
            const ip = await utils.getIp(interaction.guildId);
            if(ip) {
                const disconnected = await plugin.disconnect(interaction.guildId, interaction.client);

                if(!disconnected) {
                    const embed = getEmbed(keys.commands.connect.warnings.not_completely_disconnected, ph.emojis(), { 'ip': ip });
                    interaction.channel.send({ embeds: [embed] });
                }
                else {
                    const embed = getEmbed(keys.commands.connect.warnings.automatically_disconnected, ph.emojis(), { 'ip': ip });
                    interaction.channel.send({ embeds: [embed] });
                }
            }

            const protocol = await ftp.connect({ host, password, user, port });
            if(!protocol) {
                interaction.replyTl(keys.commands.connect.errors.could_not_connect_ftp);
                return;
            }

            //Search for server path if not given
            if(!path) {
                interaction.replyTl(keys.commands.connect.warnings.searching_properties);
                path = await ftp.find('server.properties', '', 2, { host, password, user, port, protocol });
                if(!path) {
                    interaction.replyTl(keys.commands.connect.errors.could_not_find_properties);
                    return;
                }
            }

            const serverProperties = await ftp.get(
                `${path}/server.properties`,
                `./serverdata/connections/${interaction.guildId}/server.properties`,
                { host, user, password, port, protocol },
            );
            if(!serverProperties) {
                interaction.replyTl(keys.commands.connect.errors.could_not_get_properties);
                return;
            }
            const propertiesObject = Object.fromEntries(serverProperties.toString().split('\n').map(prop => prop.split('=')));

            const ftpData = {
                'host': host,
                'user': user,
                'password': password,
                'port': port,
                'online': propertiesObject['online-mode'] === 'true',
                'path': `${path}/${propertiesObject['level-name']}`,
                'version': version,
                'protocol': protocol,
            };

            //Connected with either ftp or sftp
            //Save connection
            fs.outputJson(`./serverdata/connections/${interaction.guildId}/connection.json`, ftpData, { spaces: 2 }, async err => {
                if(err) {
                    interaction.replyTl(keys.commands.connect.errors.could_not_write_server_file);
                    return;
                }

                interaction.replyTl(keys.commands.connect.success.ftp);
            });


        }
        else if(method === 'plugin') {
            let ip = args[1]?.split(':').shift();
            const port = args[2] ?? pluginPort;

            if(!ip) {
                interaction.replyTl(keys.commands.connect.warnings.no_ip);
                return;
            }

            try {
                //Lookup ip of dns
                const { address } = await dns.lookup(ip, 4);
                if(address) ip = address;
            }
            catch(ignored) {
            }

            const verify = await plugin.verify(`${ip}:${port}`, interaction);
            if(!verify) return;

            interaction.replyTl(keys.commands.connect.warnings.check_dms);

            const verifyEmbed = getEmbed(keys.commands.connect.warnings.verification, ph.std(interaction));

            let dmChannel = await interaction.member.user.createDM();
            try {
                await dmChannel.send({ embeds: [verifyEmbed] });
            }
            catch(err) {
                dmChannel = interaction.channel;
                interaction.replyTl(keys.commands.connect.warnings.could_not_dm);
                await dmChannel.send({ embeds: [verifyEmbed] });
            }

            const collector = await dmChannel.awaitMessages({ maxProcessed: 1, time: 180_000 });

            if(!collector.first()) {
                console.log(keys.commands.connect.warnings.no_reply_in_time.console);
                const noReplyEmbed = getEmbed(keys.commands.connect.warnings.no_reply_in_time, ph.std(interaction));
                dmChannel.send({ embeds: [noReplyEmbed] });
                return;
            }

            const connectPlugin = await plugin.connect(`${ip}:${port}`, interaction.guildId, collector.first(), interaction);
            if(!connectPlugin) {
                const noConnectionEmbed = getEmbed(keys.commands.connect.errors.could_not_connect_plugin, ph.std(interaction));
                dmChannel.send({ embeds: [noConnectionEmbed] });
                return;
            }

            else if(connectPlugin === 401) {
                const incorrectCodeEmbed = getEmbed(keys.commands.connect.errors.incorrect_code, ph.std(interaction));
                dmChannel.send({ embeds: [incorrectCodeEmbed] });
                return;
            }
            else {
                const verificationEmbed = getEmbed(keys.commands.connect.success.verification, ph.std(interaction));
                dmChannel.send({ embeds: [verificationEmbed] });
            }

            const pluginJson = {
                'ip': connectPlugin.ip,
                'version': connectPlugin.version.split('.')[1],
                'path': decodeURIComponent(connectPlugin.path),
                'hash': connectPlugin.hash,
                'guild': connectPlugin.guild,
                'online': connectPlugin.online,
                'chat': false,
                'protocol': 'plugin',
            };

            fs.outputJson(`./serverdata/connections/${interaction.guildId}/connection.json`, pluginJson, { spaces: 2 }, err => {
                if(err) {
                    interaction.replyTl(keys.commands.connect.errors.could_not_write_server_file);
                    return;
                }

                interaction.replyTl(keys.commands.connect.success.plugin);
            });

        }
        else if(method === 'account') {
            const mcUsername = args[1];

            if(!mcUsername) {
                interaction.replyTl(keys.commands.connect.warnings.no_username);
                return;
            }
            else if(interaction.mentions.users.size) {
                interaction.replyTl(keys.commands.connect.warnings.user_pinged);
                return;
            }

            let uuidv4 = await utils.getUUID(mcUsername, interaction.guildId, interaction);
            if(!uuidv4) return;

            const connectionJson = {
                'id': uuidv4,
                'name': mcUsername,
            };

            fs.outputJson(`./userdata/connections/${interaction.member.user.id}/connection.json`, connectionJson, { spaces: 2 }, err => {
                if(err) {
                    interaction.replyTl(keys.commands.connect.errors.could_not_write_user_file);
                    return;
                }

                interaction.replyTl(keys.commands.connect.success.account, { 'username': mcUsername, 'uuid': uuidv4 });
            });
        }
        else {
            interaction.replyTl(keys.commands.connect.warnings.invalid_method);
        }
    }
}

module.exports = Connect;
