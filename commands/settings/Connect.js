const dns = require('dns/promises');
const crypto = require('crypto');
const { pluginPort } = require('../../config.json');
const { keys, ph, addPh } = require('../../api/messages');
const Command = require('../../structures/Command');
const PluginProtocol = require('../../structures/PluginProtocol');
const FtpProtocol = require('../../structures/FtpProtocol');
const Protocol = require('../../structures/Protocol');

class Connect extends Command {

    constructor() {
        super({
            name: 'connect',
            requiresConnectedServer: false,
            category: 'settings',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const method = args[0];

        if(method === 'ftp') {
            const host = args[1];
            let username = args[2];
            let password = args[3];
            let port = args[4] ?? 21;
            let version = args[5]?.split('.')?.pop() ?? 19;
            let path = args[6];

            if(typeof version !== 'number') version = parseInt(version);
            if(typeof port !== 'number') port = parseInt(port);

            if(isNaN(version)) {
                return interaction.replyTl(keys.commands.connect.warnings.invalid_version);
            }
            else if(isNaN(port) || port <= 0 || port > 65536) {
                return interaction.replyTl(keys.commands.connect.warnings.invalid_port);
            }

            if(username === 'none') username = '';
            if(password === 'none') password = '';

            //Send version warnings
            if(version <= 11 && version > 7) interaction.channel.send(addPh(keys.commands.connect.warnings.version_below_11, ph.std(interaction)));
            else if(version <= 7) interaction.channel.send(addPh(keys.commands.connect.warnings.version_below_7, ph.std(interaction)));

            await interaction.replyTl(keys.commands.connect.warnings.connecting);
            await this._disconnectOldPlugin(interaction, server);

            const ftpProtocol = new FtpProtocol(this.client, {
                ip: host,
                username,
                password,
                port,
                sftp: false,
            });

            const connectFtp = await ftpProtocol.connect();
            if(!connectFtp) {
                ftpProtocol.sftp = false;
                const connectSftp = await ftpProtocol.connect();
                if(!connectSftp) return interaction.replyTl(keys.commands.connect.errors.could_not_connect_ftp);
            }
            const protocol = ftpProtocol.sftp ? 'sftp' : 'ftp';
            //Search for server path if not given
            if(!path) {
                await interaction.replyTl(keys.commands.connect.warnings.searching_properties);
                path = await ftpProtocol.find('server.properties', '/', 2);
                if(!path) {
                    return interaction.replyTl(keys.commands.connect.errors.could_not_find_properties);
                }
            }

            const serverProperties = await ftpProtocol.get(Protocol.FilePath.ServerProperties(path), `./serverdata/connections/${interaction.guildId}/server.properties`);
            if(!serverProperties) {
                return interaction.replyTl(keys.api.command.errors.could_not_download, { category: 'server configuration' });
            }
            const propertiesObject = Object.fromEntries(
                serverProperties.toString('utf-8').split('\n')
                    .map(prop => prop.split('='))
            );

            const onlineMode = propertiesObject['online-mode'];

            const serverConnectionData = {
                ip: host,
                username,
                password,
                port,
                online: onlineMode ? onlineMode === 'true' : false,
                path: `${path}/${propertiesObject['level-name']}`,
                version,
                protocol,
            };

            if(server) await server.edit(serverConnectionData);
            else await client.serverConnections.connect({
                ...serverConnectionData,
                id: interaction.guildId,
            });

            await interaction.replyTl(keys.commands.connect.success.ftp);
        }
        else if(method === 'plugin') {
            let ip = args[1]?.split(':').shift();
            const port = args[2] ?? pluginPort;

            try {
                //Lookup ip of dns
                const { address } = await dns.lookup(ip, 4);
                if(address) ip = address;
            }
            catch(_) {}

            await this._disconnectOldPlugin(interaction, server);

            const hash = crypto.randomBytes(32).toString('hex');
            const pluginProtocol = new PluginProtocol(client, { ip, hash, port });

            const verify = await pluginProtocol.verify();
            if(!verify) {
                return interaction.replyTl(keys.api.plugin.errors.no_response);
            }

            await interaction.replyTl(keys.commands.connect.warnings.check_dms);

            let dmChannel = await interaction.user.createDM();
            try {
                await dmChannel.send(addPh(keys.commands.connect.warnings.verification, ph.std(interaction)));
            }
            catch(err) {
                dmChannel = interaction.channel;
                await interaction.replyTl(keys.commands.connect.warnings.could_not_dm);
                await dmChannel.send(addPh(keys.commands.connect.warnings.verification, ph.std(interaction)));
            }

            const collector = await dmChannel.awaitMessages({ maxProcessed: 1, time: 180_000 });

            if(!collector.first()) {
                console.log(keys.commands.connect.warnings.no_reply_in_time.console);
                return dmChannel.send(addPh(keys.commands.connect.warnings.no_reply_in_time, ph.std(interaction)));
            }

            const resp = await pluginProtocol.connect(collector.first());
            if(!resp) {
                return dmChannel.send(addPh(keys.commands.connect.errors.could_not_connect_plugin, ph.std(interaction)));
            }
            else if(resp.status === 401) {
                return dmChannel.send(addPh(keys.commands.connect.errors.incorrect_code, ph.std(interaction)));
            }

            await dmChannel.send(addPh(keys.commands.connect.success.verification, ph.std(interaction)));

            /** @type {ServerConnectionData} */
            const serverConnectionData = {
                id: interaction.guildId,
                ip: resp.ip,
                version: resp.version.split('.').pop(),
                path: decodeURIComponent(resp.path),
                hash: resp.hash,
                online: resp.online,
                chat: false,
                channels: [],
                protocol: 'plugin',
            };

            if(server) await server.edit(serverConnectionData);
            else await client.serverConnections.connect(serverConnectionData);

            return interaction.replyTl(keys.commands.connect.success.plugin);
        }
    }

    async _disconnectOldPlugin(interaction, server) {
        if(server?.protocol instanceof PluginProtocol) {
            const resp = await server.protocol.disconnect();

            if(!resp) {
                await interaction.channel.send(addPh(keys.commands.connect.warnings.not_completely_disconnected, ph.emojis(), { ip: server.ip }));
            }
            else {
                await interaction.channel.send(addPh(keys.commands.connect.warnings.automatically_disconnected, ph.emojis(), { ip: server.ip }));
            }
        }
    }
}

module.exports = Connect;
