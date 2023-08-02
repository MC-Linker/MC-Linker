import crypto from 'crypto';
import { addPh, addTranslatedResponses, getActionRows, getEmbed, ph } from '../../api/messages.js';
import keys from '../../api/keys.js';
import Command from '../../structures/Command.js';
import HttpProtocol from '../../structures/HttpProtocol.js';
import FtpProtocol from '../../structures/FtpProtocol.js';
import { FilePath } from '../../structures/Protocol.js';
import * as utils from '../../api/utils.js';
import { disableComponents } from '../../api/utils.js';
import client from '../../bot.js';

export default class Connect extends Command {

    wsVerification = new Map();

    waitingInteractions = new Map();

    constructor() {
        super({
            name: 'connect',
            requiresConnectedServer: false,
            category: 'settings',
            ephemeral: true,
        });


        // noinspection JSIgnoredPromiseFromCall
        client.shard.broadcastEval(
            /** @param {MCLinker} c */
            c => {
                c.on('apiReady', api => {
                    api.websocket.on('connection', async socket => {
                        const [id, userCode] = socket.handshake.auth.code?.split(':') ?? [];

                        const wsVerification = c.commands.get('connect').wsVerification;
                        if(!wsVerification.has(id)) return;

                        const {
                            code: serverCode,
                            shard,
                            requiredRoleToJoin,
                        } = wsVerification.get(id) ?? {};
                        try {
                            if(!serverCode || serverCode !== userCode) return socket.disconnect(true);

                            c.commands.get('connect').wsVerification.delete(id);
                            socket.emit('auth-success', { requiredRoleToJoin }); //Tell the plugin that the auth was successful

                            const hash = c.utils.createHash(socket.handshake.auth.token);
                            /** @type {WebSocketServerConnectionData} */
                            const serverConnectionData = {
                                id,
                                ip: socket.handshake.address,
                                path: socket.handshake.query.path,
                                chatChannels: [],
                                statChannels: [],
                                online: socket.handshake.query.online === 'true',
                                floodgatePrefix: socket.handshake.query.floodgatePrefix,
                                version: Number(socket.handshake.query.version.split('.')[1]),
                                worldPath: socket.handshake.query.worldPath,
                                protocol: 'websocket',
                                socket,
                                hash,
                                requiredRoleToJoin,
                            };

                            await c.commands.get('connect').disconnectOldServer(id);
                            await c.serverConnections.connect(serverConnectionData);

                            c.api.addListeners(socket, id, hash);

                            await c.shard.broadcastEval((c, { id }) => {
                                c.emit('editConnectResponse', id, 'success');
                            }, { context: { id }, shard });
                        }
                    catch(err) {
                        await c.shard.broadcastEval((c, { id, error }) => {
                            c.emit('editConnectResponse', id, 'error', { error_stack: error });
                        }, { context: { id, error: err.stack }, shard });
                        socket.disconnect(true);
                    }
                });
            }, { shard: 0 });
        });

        client.on('editConnectResponse', async (id, responseType, placeholders = {}) => {
            if(!this.waitingInteractions.has(id)) return;
            const { timeout, interaction } = this.waitingInteractions.get(id);

            clearTimeout(timeout);

            if(responseType === 'success') {
                await interaction.replyTl(keys.commands.connect.success.websocket, placeholders, ph.emojisAndColors());
            }
            else if(responseType === 'error') {
                await interaction.replyTl(keys.commands.connect.errors.websocket_error, placeholders, ph.emojisAndColors());
            }
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

            await interaction.replyTl(keys.commands.connect.step.connecting);

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
                await interaction.replyTl(keys.commands.connect.step.searching_properties);
                serverPath = await ftpProtocol.find('server.properties', '/', 3);
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
                floodgatePrefix: await utils.getFloodgatePrefix(ftpProtocol, serverPath, interaction.guildId),
                path: serverPath,
                worldPath: `${serverPath}${separator}${propertiesObject['level-name']}`,
                version,
                protocol,
                id: interaction.guildId,
            };

            // A button that asks the user if they want to override the old connection
            if(server) {
                const overrideEmbed = getEmbed(keys.commands.connect.warnings.already_connected, ph.emojisAndColors(), { ip: server.ip });
                const buttons = getActionRows(keys.buttons.yes_no, ph.emojisAndColors());
                const message = await interaction.replyOptions({ embeds: [overrideEmbed], components: buttons });

                const filter = i => i.user.id === interaction.user.id;
                const collector = message.createMessageComponentCollector({ filter, time: 30_000 });

                collector.on('end', async collected => {
                    if(collected.size === 0) await interaction.editReply({ components: disableComponents(message.components) });
                });

                collector.on('collect',
                    /** @param {import('discord.js').ButtonInteraction} button */
                    async button => {
                        await button.deferUpdate();

                        if(button.customId === 'yes') {
                            await this.disconnectOldServer(server);

                            await client.serverConnections.connect(serverConnectionData);
                            await interaction.replyTl(keys.commands.connect.success.ftp);
                        }
                        else if(button.customId === 'no') {
                            await interaction.replyTl(keys.commands.connect.warnings.canceled_connection);
                        }
                    });
            }
            else {
                await client.serverConnections.connect(serverConnectionData);
                await interaction.replyTl(keys.commands.connect.success.ftp);
            }
        }
        else if(method === 'backup') {
            try {
                const ip = args[1].split(':')[0];
                const port = args[2] ?? process.env.PLUGIN_PORT ?? 11111;
                const requiredRoleToJoin = args[3]?.id;

                const token = crypto.randomBytes(32).toString('hex');
                const httpProtocol = new HttpProtocol(client, { ip, token, port, id: interaction.guildId });

                const verify = await httpProtocol.verifyGuild();
                const connectedServer = await client.serverConnections.cache.find(s => s.ip === ip && s.port === port);
                const connectedServerName = connectedServer && verify.status === 409 ? (await client.guilds.fetch(connectedServer.id)).name : keys.commands.connect.unknown;
                if(!await utils.handleProtocolResponse(verify, httpProtocol, interaction, {
                    409: keys.commands.connect.warnings.plugin_already_connected,
                }, { name: connectedServerName })) return;

                const checkDmsEmbed = getEmbed(keys.commands.connect.step.check_dms, ph.emojisAndColors());
                if(server) {
                    const alreadyConnectedEmbed = getEmbed(keys.commands.connect.warnings.already_connected, ph.emojisAndColors(), { ip: server.ip });
                    await interaction.replyOptions({ embeds: [checkDmsEmbed, alreadyConnectedEmbed] });
                }
                else await interaction.replyOptions({ embeds: [checkDmsEmbed] });

                let dmChannel = await interaction.user.createDM();
                try {
                    await dmChannel.send({ embeds: [getEmbed(keys.commands.connect.step.code_verification, ph.emojisAndColors())] });
                }
                catch(err) {
                    dmChannel = interaction.channel;
                    await interaction.replyTl(keys.commands.connect.warnings.could_not_dm);
                    await dmChannel.send({ embeds: [getEmbed(keys.commands.connect.step.code_verification, ph.emojisAndColors())] });
                }

                const collector = await dmChannel.awaitMessages({
                    max: 1,
                    time: 180_000,
                    filter: message => message.author.id === interaction.user.id,
                });
                const message = collector.size !== 0 ? addTranslatedResponses(collector.first()) : null;
                if(!message) return dmChannel.send(addPh(keys.commands.connect.warnings.no_reply_in_time, ph.emojisAndColors()));

                const resp = await httpProtocol.connect(collector.first().content, requiredRoleToJoin);
                if(!await utils.handleProtocolResponse(resp, httpProtocol, interaction, {
                    401: keys.commands.connect.errors.incorrect_code,
                })) {
                    await message.replyTl(keys.commands.connect.errors.incorrect_code);
                    return;
                }

                await message.replyTl(keys.commands.connect.success.verification);

                const serverPath = decodeURIComponent(resp.data.path);
                /** @type {HttpServerConnectionData} */
                const serverConnectionData = {
                    ip,
                    port,
                    version: parseInt(resp.data.version.split('.')[1]),
                    path: serverPath,
                    worldPath: decodeURIComponent(resp.data.worldPath),
                    floodgatePrefix: resp.data.floodgatePrefix,
                    token: resp.data.token,
                    online: resp.data.online,
                    protocol: 'http',
                    requiredRoleToJoin,
                    chatChannels: [],
                    statChannels: [],
                    id: interaction.guildId,
                };

                await this.disconnectOldServer(server);
                await client.serverConnections.connect(serverConnectionData);

                return interaction.replyTl(keys.commands.connect.success.plugin);
            }
            catch(_) {}
        }
        else if(method === 'plugin') {
            const code = crypto.randomBytes(16).toString('hex').slice(0, 5);
            const requiredRoleToJoin = args[1]?.id;

            const verificationEmbed = getEmbed(keys.commands.connect.step.command_verification, ph.emojisAndColors(), { code: `${interaction.guildId}:${code}` });
            if(server) {
                const alreadyConnectedEmbed = getEmbed(keys.commands.connect.warnings.already_connected, ph.emojisAndColors(), { ip: server.ip });
                await interaction.replyOptions({ embeds: [verificationEmbed, alreadyConnectedEmbed] });
            }
            else await interaction.replyOptions({ embeds: [verificationEmbed] });

            const timeout = setTimeout(async () => {
                await interaction.replyTl(keys.commands.connect.warnings.no_reply_in_time);
            }, 180_000);

            this.waitingInteractions.set(interaction.guildId, { interaction, timeout });
            await client.shard.broadcastEval((c, { code, id, shard, requiredRoleToJoin }) => {
                c.commands.get('connect').wsVerification.set(id, { code, shard, requiredRoleToJoin });
            }, {
                context: { code, id: interaction.guildId, shard: client.shard.ids[0], requiredRoleToJoin },
                shard: 0,
            });

            //Connection and interaction response will now be handled by connection listener in constructor or by the timeout
        }
    }

    /**
     * Disconnects all active connections of this server.
     * @param {ServerConnectionResolvable} serverResolvable - The server to disconnect.
     * @returns {Promise<boolean>} - Whether the server was disconnected.
     */
    async disconnectOldServer(serverResolvable) {
        const server = client.serverConnections.resolve(serverResolvable);
        if(server?.protocol?.isPluginProtocol()) await server.protocol.disconnect();
        if(server) return await client.serverConnections.disconnect(server);
    }
}
