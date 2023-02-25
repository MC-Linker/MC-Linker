import crypto from 'crypto';
import { addPh, addTranslatedResponses, getEmbed, getModal, ph } from '../../api/messages.js';
import keys from '../../api/keys.js';
import Command from '../../structures/Command.js';
import HttpProtocol from '../../structures/HttpProtocol.js';
import FtpProtocol from '../../structures/FtpProtocol.js';
import { FilePath } from '../../structures/Protocol.js';
import * as utils from '../../api/utils.js';
import client from '../../bot.js';

export default class Connect extends Command {

    wsVerification = new Map();

    waitingInteractions = new Map();

    constructor() {
        super({
            name: 'connect',
            requiresConnectedServer: false,
            category: 'settings',
            defer: false,
        });

        // noinspection JSIgnoredPromiseFromCall
        client.shard.broadcastEval(c => {
            c.api.websocket.on('connection', async socket => {
                const [id, userCode] = socket.handshake.auth.code?.split(':') ?? [];

                const wsVerification = c.commands.get('connect').wsVerification;
                if(!wsVerification.has(id)) return;

                const {
                    code: serverCode,
                    server,
                    shard,
                } = wsVerification.get(id) ?? {};
                try {
                    if(!serverCode || serverCode !== userCode) return socket.disconnect(true);

                    //Prevent connection of a different guild to an already connected server
                    /** @type {?ServerConnection} */
                    const alreadyConnectedServer = c.serverConnections.cache.find(s => s.ip === socket.handshake.address && s.id !== id);
                    if(alreadyConnectedServer) {
                        const guild = await c.guilds.fetch(alreadyConnectedServer.id);
                        await c.shard.broadcastEval((c, { id, server }) => {
                            c.emit('editConnectResponse', id, 'already_connected', { server });
                        }, { context: { id, server: guild.name }, shard });
                        return socket.disconnect(true);
                    }

                    c.commands.get('connect').wsVerification.delete(id);
                    socket.emit('auth-success', {}); //Tell the plugin that the auth was successful

                    const hash = utils.createHash(socket.handshake.auth.token);
                    /** @type {WebSocketServerConnectionData} */
                    const serverConnectionData = {
                        id,
                        ip: socket.handshake.address,
                        path: socket.handshake.query.path,
                        channels: [],
                        online: Boolean(socket.handshake.query.online),
                        version: Number(socket.handshake.query.version),
                        worldPath: socket.handshake.query.worldPath,
                        protocol: 'websocket',
                        hash,
                        socket,
                    };

                    if(server) await server.edit(serverConnectionData);
                    else await client.serverConnections.connect(serverConnectionData);

                    c.api.addListeners(socket, client.serverConnections.cache.get(id), hash);

                    await c.shard.broadcastEval((c, { id }) => {
                        c.emit('editConnectResponse', id, 'success');
                    }, { context: { id }, shard });
                }
                catch(err) {
                    await c.shard.broadcastEval((c, { id, error }) => {
                        c.emit('editConnectResponse', id, 'error', { error });
                    }, { context: { id, error: err }, shard });
                    socket.disconnect(true);
                }
            });
        }, { shard: 0 });

        client.on('editConnectResponse', async (id, responseType, placeholders = {}) => {
            if(!this.waitingInteractions.has(id)) return;
            const { timeout, interaction } = this.waitingInteractions.get(id);

            clearTimeout(timeout);

            if(responseType === 'success') {
                await interaction.replyTl(keys.commands.connect.success.websocket, placeholders, ph.emojis());
            }
            else if(responseType === 'already_connected') {
                await interaction.replyTl(keys.commands.connect.warnings.already_connected, placeholders, ph.emojis());
            }
            else if(responseType === 'error') {
                await interaction.replyTl(keys.commands.connect.errors.websocket_error, placeholders, ph.emojis());
            }
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const method = args[0];
        if(method === 'ftp') {
            await interaction.deferReply({ ephemeral: this.ephemeral });

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
                serverPath = await ftpProtocol.find('server.properties', '', 3);
                serverPath = serverPath?.data;
                if(typeof serverPath !== 'string') {
                    return interaction.replyTl(keys.commands.connect.errors.could_not_find_properties);
                }
            }

            const serverProperties = await ftpProtocol.get(...FilePath.ServerProperties(serverPath, interaction.guildId));
            if(!await utils.handleProtocolResponse(serverProperties, ftpProtocol, interaction, {
                404: keys.commands.connect.errors.could_not_get_properties,
            })) return;

            const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));
            let separator = serverPath.includes('\\') ? '\\' : '/';
            if(serverPath.endsWith(separator) || propertiesObject['level-name'].startsWith(separator)) separator = '';

            /** @type {FtpServerConnectionData} */
            const serverConnectionData = {
                ip: host,
                username,
                password,
                port,
                online: propertiesObject['online-mode'],
                path: serverPath,
                worldPath: `${serverPath}${separator}${propertiesObject['level-name']}`,
                version,
                protocol,
                id: interaction.guildId,
            };

            if(client.serverConnections.cache.has(id)) await server.edit(serverConnectionData);
            else await client.serverConnections.connect(serverConnectionData);

            await interaction.replyTl(keys.commands.connect.success.ftp);
        }
        else if(method === 'plugin') {
            const usesBackupMethod = args[1] ?? false;
            if(usesBackupMethod) {
                try {
                    await interaction.showModal(getModal(keys.modals.connect_backup));
                    let modal = await interaction.awaitModalSubmit({ time: 180_000 });
                    await modal.deferReply();
                    modal = addTranslatedResponses(modal);

                    const ip = modal.fields.getTextInputValue('ip').split(':')[0];
                    let port = parseInt(modal.fields.getTextInputValue('port'));
                    if(isNaN(port)) port = process.env.PLUGIN_PORT ?? 11111;

                    await this._disconnectOldPlugin(modal, server);

                    const token = crypto.randomBytes(32).toString('hex');
                    const httpProtocol = new HttpProtocol(client, { ip, token, port, id: interaction.guildId });

                    const verify = await httpProtocol.verifyGuild();
                    if(!await utils.handleProtocolResponse(verify, httpProtocol, modal, {
                        409: keys.commands.connect.warnings.already_connected,
                    })) return;

                    await modal.replyTl(keys.commands.connect.warnings.check_dms);

                    let dmChannel = await interaction.user.createDM();
                    try {
                        await dmChannel.send({ embeds: [getEmbed(keys.commands.connect.warnings.verification, ph.emojis())] });
                    }
                    catch(err) {
                        dmChannel = modal.channel;
                        await modal.replyTl(keys.commands.connect.warnings.could_not_dm);
                        await dmChannel.send({ embeds: [getEmbed(keys.commands.connect.warnings.verification, ph.emojis())] });
                    }

                    const collector = await dmChannel.awaitMessages({
                        max: 1,
                        time: 180_000,
                        filter: message => message.author.id === interaction.user.id,
                    });
                    const message = collector.size !== 0 ? addTranslatedResponses(collector.first()) : null;
                    if(!message) {
                        console.log(keys.commands.connect.warnings.no_reply_in_time.console);
                        return dmChannel.send(addPh(keys.commands.connect.warnings.no_reply_in_time, ph.emojis()));
                    }

                    const resp = await httpProtocol.connect(collector.first().content);
                    if(!await utils.handleProtocolResponse(resp, httpProtocol, modal, {
                        401: keys.commands.connect.errors.incorrect_code,
                    })) {
                        await message.replyTl(keys.commands.connect.errors.incorrect_code);
                        return;
                    }

                    await message.replyTl(keys.commands.connect.success.verification);

                    /** @type {HttpServerConnectionData} */
                    const serverConnectionData = {
                        ip,
                        port,
                        version: parseInt(resp.data.version.split('.')[1]),
                        path: decodeURIComponent(resp.data.path),
                        worldPath: decodeURIComponent(resp.data.worldPath),
                        token: resp.data.token,
                        online: resp.data.online,
                        protocol: 'http',
                        channels: [],
                        id: interaction.guildId,
                    };

                    //If old connection was automatically disconnected, connect a new server connection otherwise edit the old one
                    if(client.serverConnections.cache.has(interaction.guildId)) await server.edit(serverConnectionData);
                    else await client.serverConnections.connect(serverConnectionData);

                    return modal.replyTl(keys.commands.connect.success.plugin);
                }
                catch(_) {}
            }
            else {
                await interaction.deferReply({ ephemeral: this.ephemeral });
                await this._disconnectOldPlugin(interaction, server);

                const code = crypto.randomBytes(16).toString('hex').slice(0, 5);
                await interaction.replyTl(keys.commands.connect.success.verification_info, { code: `${interaction.guildId}:${code}` });

                const timeout = setTimeout(async () => {
                    await interaction.replyTl(keys.commands.connect.warnings.no_reply_in_time);
                }, 180_000);

                this.waitingInteractions.set(interaction.guildId, { interaction, timeout });
                await client.shard.broadcastEval((c, { code, id, shard }) => {
                    const server = c.serverConnections.cache.get(id);
                    c.commands.get('connect').wsVerification.set(id, { code, server, shard });
                }, { context: { code, id: interaction.guildId, shard: client.shard.ids[0] }, shard: 0 });

                //Connection and interaction response will now be handled by connection listener in constructor or by the timeout
            }
        }
    }

    async _disconnectOldPlugin(interaction, server) {
        /** @type {?ProtocolResponse} */
        let resp;
        if(server?.hasHttpProtocol()) resp = await server.protocol.disconnect();
        else if(server?.hasWebSocketProtocol()) resp = server.protocol.disconnect();
        else if(server?.hasFtpProtocol()) return await client.serverConnections.disconnect(server);
        else return;

        if(!resp || resp.status !== 200) await interaction.channel.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), { ip: server.ip }));
        else {
            await client.serverConnections.disconnect(server);
            await interaction.channel.send(addPh(keys.api.plugin.warnings.automatically_disconnected, ph.emojis(), { ip: server.ip }));
        }
    }
}
