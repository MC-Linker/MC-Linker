const crypto = require('crypto');
const { pluginPort } = require('../../config.json');
const { ph, addPh, addTranslatedResponses, getEmbed } = require('../../api/messages');
const { keys } = require('../../api/keys');
const Command = require('../../structures/Command');
const PluginProtocol = require('../../structures/PluginProtocol');
const FtpProtocol = require('../../structures/FtpProtocol');
const Protocol = require('../../structures/Protocol');
const utils = require('../../api/utils');

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
            let version = args[5]?.split('.')[1] ?? 19;
            let serverPath = args[6];

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
                ftpProtocol.sftp = true;
                const connectSftp = await ftpProtocol.connect();
                if(!connectSftp) return interaction.replyTl(keys.commands.connect.errors.could_not_connect_ftp);
            }
            const protocol = ftpProtocol.sftp ? 'sftp' : 'ftp';
            //Search for server path if not given
            if(!serverPath) {
                await interaction.replyTl(keys.commands.connect.warnings.searching_properties);
                serverPath = await ftpProtocol.find('server.properties', '', 2);
                serverPath = serverPath?.data;
                if(!serverPath) {
                    return interaction.replyTl(keys.commands.connect.errors.could_not_find_properties);
                }
            }

            const serverProperties = await ftpProtocol.get(Protocol.FilePath.ServerProperties(serverPath), `./serverdata/connections/${interaction.guildId}/server.properties`);
            if(!await utils.handleProtocolResponse(serverProperties, ftpProtocol, interaction, {
                404: keys.commands.connect.errors.could_not_get_properties,
            })) return;

            const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));
            const separator = serverPath.includes('/') ? '/' : '\\';
            const serverConnectionData = {
                ip: host,
                username,
                password,
                port,
                online: propertiesObject['online-mode'],
                path: `${serverPath}${separator}${propertiesObject['level-name']}`,
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

            await this._disconnectOldPlugin(interaction, server);

            const hash = crypto.randomBytes(32).toString('hex');
            const pluginProtocol = new PluginProtocol(client, { ip, hash, port, id: interaction.guildId });

            const verify = await pluginProtocol.verify();
            if(!await utils.handleProtocolResponse(verify, pluginProtocol, interaction, {
                409: keys.commands.connect.warnings.already_connected,
            })) return;

            await interaction.replyTl(keys.commands.connect.warnings.check_dms);

            let dmChannel = await interaction.user.createDM();
            try {
                await dmChannel.send({ embeds: [getEmbed(keys.commands.connect.warnings.verification, ph.std(interaction))] });
            }
            catch(err) {
                dmChannel = interaction.channel;
                await interaction.replyTl(keys.commands.connect.warnings.could_not_dm);
                await dmChannel.send({ embeds: [getEmbed(keys.commands.connect.warnings.verification, ph.std(interaction))] });
            }

            const collector = await dmChannel.awaitMessages({
                max: 1,
                time: 180_000,
                filter: message => message.author.id === interaction.user.id,
            });
            const message = collector.size !== 0 ? addTranslatedResponses(collector.first()) : null;
            if(!message) {
                console.log(keys.commands.connect.warnings.no_reply_in_time.console);
                return dmChannel.send(addPh(keys.commands.connect.warnings.no_reply_in_time, ph.std(interaction)));
            }

            const resp = await pluginProtocol.connect(collector.first());
            if(!await utils.handleProtocolResponse(resp, pluginProtocol, interaction, {
                401: keys.commands.connect.errors.incorrect_code,
            })) {
                await message.replyTl(keys.commands.connect.errors.incorrect_code);
                return;
            }

            await message.replyTl(keys.commands.connect.success.verification, ph.std(interaction));

            /** @type {ServerConnectionData} */
            const serverConnectionData = {
                id: interaction.guildId,
                ip: resp.data.ip.split(':').shift(),
                port: resp.data.ip.split(':').pop(),
                version: parseInt(resp.data.version.split('.')[1]),
                path: decodeURIComponent(resp.data.path),
                hash: resp.data.hash,
                online: resp.data.online,
                protocol: 'plugin',
            };

            if(server) await server.edit(serverConnectionData);
            else await client.serverConnections.connect(serverConnectionData);

            return interaction.replyTl(keys.commands.connect.success.plugin);
        }
    }

    async _disconnectOldPlugin(interaction, server) {
        if(server?.protocol instanceof PluginProtocol) {
            /** @type {?ProtocolResponse} */
            const resp = await server.protocol.disconnect();

            if(!resp || resp.status !== 200) await interaction.channel.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), { ip: server.ip }));
            else await interaction.channel.send(addPh(keys.api.plugin.warnings.automatically_disconnected, ph.emojis(), { ip: server.ip }));
        }
    }
}

module.exports = Connect;
