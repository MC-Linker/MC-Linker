import crypto from 'crypto';
import { addPh, addTranslatedResponses, getEmbed, ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import HttpProtocol from '../../structures/HttpProtocol.js';
import FtpProtocol from '../../structures/FtpProtocol.js';
import * as utils from '../../utilities/utils.js';
import client from '../../bot.js';
import Discord from 'discord.js';
import { FilePath } from '../../structures/ServerConnection.js';

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
                            displayIp,
                            online,
                        } = wsVerification.get(id) ?? {};
                        try {
                            if(!serverCode || serverCode !== userCode) return socket.disconnect(true);

                            c.commands.get('connect').wsVerification.delete(id);
                            socket.emit('auth-success', { requiredRoleToJoin }); //Tell the plugin that the auth was successful

                            const hash = c.utils.createHash(socket.handshake.auth.token);
                            /** @type {WebSocketServerConnectionData} */
                            const serverData = {
                                id,
                                ip: socket.handshake.address,
                                path: socket.handshake.query.path,
                                chatChannels: [],
                                statChannels: [],
                                online: online ?? socket.handshake.query.online === 'true',
                                forceOnlineMode: online !== undefined,
                                floodgatePrefix: socket.handshake.query.floodgatePrefix,
                                version: Number(socket.handshake.query.version.split('.')[1]),
                                worldPath: socket.handshake.query.worldPath,
                                protocol: 'websocket',
                                socket,
                                hash,
                                requiredRoleToJoin,
                                displayIp,
                            };

                            await c.serverConnections.connect(serverData);

                            c.api.addWebsocketListeners(socket, id, hash);

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
            const serverData = {
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

            await client.serverConnections.connect(serverData);
            await interaction.replyTl(keys.commands.connect.success.ftp);
        }
        else if(method === 'backup') {
            const ip = args[1].split(':')[0];
            let port = args[2] ?? process.env.PLUGIN_PORT ?? 11111;
            if(typeof port !== 'number') port = parseInt(port);
            const joinRequirement = args[3];

            let selectResponse = joinRequirement === 'roles' ? await this.askForRequiredRolesToJoin(interaction) : null;
            if(!selectResponse && joinRequirement === 'roles') return; //User didn't respond in time
            else if(joinRequirement === 'link') selectResponse = { roles: [], method: 'all' }; //No roles still requires linked account

            const token = crypto.randomBytes(32).toString('hex');
            const httpProtocol = new HttpProtocol(client, { ip, token, port, id: interaction.guildId });

            const verify = await httpProtocol.verifyGuild();
            const connectedServer = verify?.status === 409 ? client.serverConnections.cache.find(c => c.links.find(s => s.ip === ip && s.port === port)) : null;
            const connectedServerName = connectedServer && verify?.status === 409 ? (await client.guilds.fetch(connectedServer.id)).name : keys.commands.connect.unknown;
            if(!await utils.handleProtocolResponse(verify, httpProtocol, interaction, {
                409: keys.commands.connect.warnings.plugin_already_connected,
            }, { name: connectedServerName ?? keys.commands.connect.unknown })) return;

            const checkDmsEmbed = getEmbed(keys.commands.connect.step.check_dms, ph.emojisAndColors());
            await interaction.replyOptions({ embeds: [checkDmsEmbed], components: [] });

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

            const resp = await httpProtocol.connect(collector.first().content, selectResponse);
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
                requiredRoleToJoin: selectResponse,
                chatChannels: [],
                statChannels: [],
                id: interaction.guildId,
            };

            await client.serverConnections.connect(serverConnectionData);
            return interaction.replyTl(keys.commands.connect.success.plugin);
        }
        else if(method === 'plugin') {
            const code = crypto.randomBytes(16).toString('hex').slice(0, 5);
            const joinRequirement = args[1];
            const displayIp = args[2];
            const online = args[3];

            let selectResponse = joinRequirement === 'roles' ? await this.askForRequiredRolesToJoin(interaction) : null;
            if(!selectResponse && joinRequirement === 'roles') return; //User didn't respond in time
            else if(joinRequirement === 'link') selectResponse = { roles: [], method: 'all' }; //No roles still requires linked account

            await interaction.replyOptions({ embeds: [verificationEmbed], components: [] });

            const timeout = setTimeout(async () => {
                await client.shard.broadcastEval((c, { id }) => {
                    c.commands.get('connect').wsVerification.delete(id);
                }, { context: { id: interaction.guildId }, shard: 0 });
                await interaction.replyTl(keys.commands.connect.warnings.no_reply_in_time);
            }, 180_000);

            this.waitingInteractions.set(interaction.guildId, { interaction, timeout });
            await client.shard.broadcastEval((c, { code, id, shard, requiredRoleToJoin, displayIp, online }) => {
                c.commands.get('connect').wsVerification.set(id, {
                    code,
                    shard,
                    requiredRoleToJoin,
                    displayIp,
                    online,
                });
            }, {
                context: {
                    code,
                    id: interaction.guildId,
                    shard: client.shard.ids[0],
                    requiredRoleToJoin: selectResponse,
                    displayIp,
                    online,
                },
                shard: 0,
            });

            //Connection and interaction response will now be handled by connection listener in constructor or by the timeout
        }
    }

    /**
     * This will send a select menu to the user asking for the required roles to join the server and the method to check them.
     * @param {Discord.CommandInteraction & TranslatedResponses} interaction - The interaction to reply to.
     * @returns {Promise<?RequiredRoleToJoinData>} - The roles and the method or null if the user didn't respond in time.
     */
    askForRequiredRolesToJoin(interaction) {
        return new Promise(async resolve => {
            const logChooserMsg = await interaction.replyTl(keys.commands.connect.step.choose_roles);

            const roleCollector = logChooserMsg.createMessageComponentCollector({
                componentType: Discord.ComponentType.RoleSelect,
                time: 180_000,
            });

            const methodCollector = logChooserMsg.createMessageComponentCollector({
                componentType: Discord.ComponentType.StringSelect,
                time: 180_000,
            });

            roleCollector.on('collect', async menu => {
                if(menu.customId !== 'required_roles') return;

                await menu.deferUpdate();
                if(methodCollector.total >= 1) {
                    roleCollector.stop();
                    methodCollector.stop();
                }
            });

            methodCollector.on('collect', async menu => {
                if(menu.customId !== 'required_roles_method') return;

                await menu.deferUpdate();
                if(roleCollector.total >= 1) {
                    roleCollector.stop();
                    methodCollector.stop();
                }
            });

            //Only one of the collectors should listen to the end event
            roleCollector.on('end', async collected => {
                if(collected.size === 0 || methodCollector.total === 0) {
                    await interaction.replyTl(keys.commands.connect.warnings.not_collected);
                    return resolve(null);
                }

                // Resolve with last collected
                const roles = collected.last().values;
                const method = methodCollector.collected.last().values[0];
                resolve({ roles, method });
            });

            methodCollector.on('end', async () => {}); // Will throw an error if not defined (i think)
        });
    }
}
