import crypto from 'crypto';
import { getEmbed, ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import client from '../../bot.js';
import Discord from 'discord.js';

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
                            const serverConnectionData = {
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

                            await c.commands.get('connect').disconnectOldServer(id);
                            await c.serverConnections.connect(serverConnectionData);

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

        const joinRequirement = args[0];
        const displayIp = args[1];
        const online = args[2];

        const code = crypto.randomBytes(16).toString('hex').slice(0, 5);
        let selectResponse = joinRequirement === 'roles' ? await this.askForRequiredRolesToJoin(interaction) : null;
        if(!selectResponse && joinRequirement === 'roles') return; //User didn't respond in time
        else if(joinRequirement === 'link') selectResponse = { roles: [], method: 'all' }; //No roles still requires linked account

        const verificationEmbed = getEmbed(keys.commands.connect.step.command_verification, ph.emojisAndColors(), { code: `${interaction.guildId}:${code}` });
        if(server) {
            const alreadyConnectedEmbed = getEmbed(keys.commands.connect.warnings.already_connected, ph.emojisAndColors(), { ip: server.getDisplayIp() });
            await interaction.replyOptions({ embeds: [verificationEmbed, alreadyConnectedEmbed], components: [] });
        }
        else await interaction.replyOptions({ embeds: [verificationEmbed], components: [] });

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

    /**
     * Disconnects all active connections of this server.
     * @param {ServerConnectionResolvable} serverResolvable - The server to disconnect.
     * @returns {Promise<boolean>} - Whether the server was disconnected.
     */
    async disconnectOldServer(serverResolvable) {
        const server = client.serverConnections.resolve(serverResolvable);
        await server.protocol.disconnect();
        if(server) return await client.serverConnections.disconnect(server);
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

            methodCollector.on('end', async () => {
            }); // Will throw an error if not defined (i think)
        });
    }
}
