// noinspection HttpUrlsUsage
import Fastify from 'fastify';
import { getOAuthURL, getTokens, getUser } from './oauth.js';
import { createHash, getMinecraftAvatarURL, searchAdvancements } from './utils.js';
import { addPh, getEmbed, ph } from './messages.js';
import keys from './keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import fastifyIO from 'fastify-socket.io';
import Discord from 'discord.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export default class BotAPI extends EventEmitter {

    /**
     * The websocket instance for the api.
     * @type {import('socket.io').Server}
     */
    websocket;

    /**
     * The rate limiter for chat-channel endpoints that are not of type chat.
     * @type {RateLimiterMemory}
     */
    rateLimiterChatChannels = new RateLimiterMemory({
        keyPrefix: 'chatchannels',
        points: 2, // 1 updates
        duration: 1, // per second
    });

    /**
     * The rate limiter for chat-channel endpoints of type chat.
     * @type {RateLimiterMemory}
     */
    rateLimiterChats = new RateLimiterMemory({
        keyPrefix: 'chats',
        points: 20, // 20 messages
        duration: 10, // per 10 seconds
    });

    /**
     * The rate limiter for stats-channel endpoints.
     * @type {RateLimiterMemory}
     */
    rateLimiterMemberCounter = new RateLimiterMemory({
        keyPrefix: 'member-counters',
        points: 2, // 1 points
        duration: 60 * 5, // per 5 minutes
    });

    /**
     * A map of users that are awaiting verification. The map consists of verification codes and and their username and uuid.
     * @type {Map<String, { username: String, uuid: String }>}
     */
    usersAwaitingVerification = new Map();

    constructor(client) {
        super();
        super.setMaxListeners(0); // Set unlimited listeners

        /**
         * The client this api is for.
         * @type {MCLinker}
         */
        this.client = client;

        /**
         * The fastify instance for the api.
         * @type {import('fastify').FastifyInstance}
         */
        this.fastify = Fastify();
        // noinspection JSCheckFunctionSignatures
        this.fastify.register(fastifyIO);
        this.fastify.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });

        this.fastify.addHook('preHandler', (request, reply, done) => {
            this.emit(request.url, request, reply);
            done();
        });
    }

    async startServer() {
        async function _getServerFastify(request, reply, client, rateLimiter = null) {
            try {
                if(rateLimiter) await rateLimiter.consume(request.ip);

                const id = request.body.id;
                const ip = request.body.ip.split(':')[0];
                const port = request.body.ip.split(':')[1];

                /** @type {ServerConnection} */
                const server = client.serverConnections.cache.find(server => server.protocol.isHttpProtocol() && server.id === id && server.ip === ip && server.port === parseInt(port));
                //If no connection on that guild send disconnection status
                if(!server) reply.status(403).send({});

                //check authorization: Bearer <token>
                if(!request.headers.authorization || createHash(server.token) !== request.headers.authorization?.split(' ')[1]) {
                    reply.status(401).send({});
                    return;
                }

                return server;
            }
            catch(rateLimiterRes) {
                reply.status(429).headers({
                    'Retry-After': rateLimiterRes.msBeforeNext / 1000,
                    'X-RateLimit-Limit': rateLimiter.points,
                    'X-RateLimit-Remaining': rateLimiterRes.remainingPoints,
                    'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext),
                }).send({ message: 'Too many requests' });
            }
        }

        this.fastify.post('/chat', async (request, reply) => {
            const rateLimiter = request.body?.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels;
            const server = await _getServerFastify(request, reply, this.client, rateLimiter);
            if(!server) return;

            reply.send({});
            await this._chat(request.body, server);
        });

        this.fastify.post('/update-stats-channels', async (request, reply) => {
            const rateLimiter = request.body.event === 'members' ? this.rateLimiterMemberCounter : null;
            const server = await _getServerFastify(request, reply, this.client, rateLimiter);
            if(!server) return;

            reply.send({});
            await this._updateStatsChannel(request.body, server);
        });

        this.fastify.get('/update-synced-role', async (request, reply) => {
            const server = await _getServerFastify(request, reply, this.client);
            if(!server) return;
            reply.send({});
            await this._updateSyncedRole(request.body, server);
        });

        this.fastify.post('/disconnect-force', async (request, reply) => {
            const server = await _getServerFastify(request, reply, this.client);
            if(!server) return;

            reply.send({});
            await this.client.serverConnections.disconnect(server);
        });

        this.fastify.post('/has-required-role', async (request, reply) => {
            const server = await _getServerFastify(request, reply, this.client);
            if(!server) return;
            const response = await this._hasRequiredRoleToJoin(request.body.uuid, server);
            if(response === 'error') reply.status(500);
            reply.send({ response });
        });

        this.fastify.post('/verify-user', async (request, reply) => {
            const data = request.body;
            const server = await _getServerFastify(request, reply, this.client);
            if(!server) return;
            reply.send({});
            this._verifyUser(data);
        });

        this.fastify.post('/invite-url', async (request, reply) => {
            const server = await _getServerFastify(request, reply, this.client);
            if(!server) return;
            const url = await this._getInviteUrl(server.id);
            if(!url) reply.status(500).send({});
            reply.send({ url });
        });

        this.fastify.get('/linked-role', async (request, reply) => {
            // Generate state
            const { state, url } = getOAuthURL();
            reply.setCookie('state', state, { maxAge: 1000 * 60 * 5, signed: true });
            reply.redirect(url);
        });

        this.fastify.get('/linked-role/callback', async (request, reply) => {
            const { code, state: discordState } = request.query;

            //Check state
            const clientState = reply.unsignCookie(request.cookies.state);
            if(clientState.valid && clientState.value !== discordState) return reply.status(403).send();

            //Get access and refresh token
            const tokens = await getTokens(code);
            if(!tokens) return reply.status(403).send();

            //Get user
            const user = await getUser(this.client, tokens.accessToken);
            if(!user) return reply.status(403).send();

            let settings = this.client.userSettingsConnections.cache.get(user.id);
            if(settings) settings.edit({
                tokens: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expires: tokens.expires,
                },
            });
            else settings = await this.client.userSettingsConnections.connect({
                id: user.id,
                tokens: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expires: tokens.expires,
                },
            });

            const userConnection = this.client.userConnections.cache.get(user.id);
            await settings.updateRoleConnection(userConnection?.username, {
                'connectedaccount': userConnection ? 1 : 0,
            });

            reply.send(`You have been authorized as ${user.tag}! You can now close this window and go back to Discord.`);
        });

        //Returns latest version
        this.fastify.get('/version', () => process.env.PLUGIN_VERSION);
        //Root endpoint
        this.fastify.get('/', (request, reply) => {
            reply.redirect('https://mclinker.com');
        });

        this.fastify.listen({ port: process.env.BOT_PORT, host: '0.0.0.0' }, (err, address) => {
            if(err) throw err;
            console.log(addPh(keys.api.plugin.success.listening.console, { address }));
        });

        await this.fastify.ready(); //Await websocket plugin loading
        this.websocket = this.fastify.io;

        this.websocket.on('connection', socket => {
            const [id] = socket.handshake.auth.code?.split(':') ?? [];

            //Check if awaiting verification (will be handled by connect command)
            if(this.client.commands.get('connect')?.wsVerification?.has(id)) return;

            const token = socket.handshake.auth.token;
            const hash = createHash(token);

            /** @type {?ServerConnection} */
            const server = this.client.serverConnections.cache.find(server => server.protocol.isWebSocketProtocol() && server.hash === hash);
            if(!server) return socket.disconnect();

            socket.emit('auth-success', {}); //Tell the client that the auth was successful

            server.protocol.updateSocket(socket);
            this.addListeners(socket, server, hash);
        });

        this.client.emit('apiReady', this);
        return this.fastify;
    }

    /**
     * Adds websocket listeners to the provided socket instance.
     * @param {Socket} socket - The socket to add the listeners to.
     * @param {ServerConnectionResolvable} serverResolvable - The server-connection related to the socket.
     * @param {string} hash - The hash to use for verifying server-connections.
     */
    addListeners(socket, serverResolvable, hash) {
        /** @type {ServerConnection<WebSocketProtocol>} */
        const server = this.client.serverConnections.resolve(serverResolvable);
        socket.on('chat', async data => {
            data = JSON.parse(data);
            const rateLimiter = data.type === 'chat' ? this.rateLimiterChats : this.rateLimiterChatChannels;
            const server = await getServerWebsocket(this.client, rateLimiter);
            if(!server) return;
            await this._chat(data, server);
        });
        socket.on('update-stats-channels', async data => {
            data = JSON.parse(data);
            const rateLimiter = data.event === 'members' ? this.rateLimiterMemberCounter : null;
            const server = await getServerWebsocket(this.client, rateLimiter);
            if(!server) return;
            await this._updateStatsChannel(data, server);
        });
        socket.on('update-synced-role', async data => {
            data = JSON.parse(data);
            const server = await getServerWebsocket(this.client);
            if(!server) return;
            await this._updateSyncedRole(data, server);
        });
        socket.on('disconnect-force', async () => {
            // `/linker disconnect` was executed in minecraft, disconnect the server from discord
            await this.client.serverConnections.disconnect(server);
        });
        socket.on('has-required-role', async (data, callback) => {
            data = JSON.parse(data);
            const server = await getServerWebsocket(this.client);
            if(!server) return;
            const response = await this._hasRequiredRoleToJoin(data.uuid, server);
            callback({ response });
        });
        socket.on('invite-url', async callback => {
            const server = await getServerWebsocket(this.client);
            if(!server) return;
            callback(await this._getInviteUrl(server.id));
        });
        socket.on('verify-user', async data => {
            data = JSON.parse(data);
            const server = await getServerWebsocket(this.client);
            if(!server) return;
            this._verifyUser(data);
        });
        socket.on('disconnect', () => {
            server.protocol.updateSocket(null);
        });

        async function getServerWebsocket(client, rateLimiter = null) {
            try {
                if(rateLimiter) await rateLimiter.consume(socket.handshake.address);

                //Update server variable to ensure it wasn't disconnected in the meantime
                /** @type {?ServerConnection} */
                const server = client.serverConnections.cache.find(server => server.protocol.isWebSocketProtocol() && server.hash === hash);

                //If no connection on that guild, disconnect socket
                if(!server) {
                    socket.disconnect();
                    return;
                }
                return server;
            }
            catch(rejRes) {
                socket.emit('blocked', { 'retry-ms': rejRes.msBeforeNext });
            }
        }
    }

    /**
     * Handles chat messages.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<void>}
     * @private
     */
    async _chat(data, server) {
        const { message, channels, type, player } = data;
        const guildId = server.id;
        const authorURL = await getMinecraftAvatarURL(player);

        const argPlaceholder = { username: player, author_url: authorURL, message };

        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type)) {
            const commandName = message.replace(/^\//, '').split(/\s+/)[0];
            if(server.settings.isDisabled('chatCommands', commandName)) return;
        }

        const guild = await this.client.guilds.fetch(guildId);

        //Add special placeholders for advancements
        if(type === 'advancement') {
            let advancementTitle;
            let advancementDesc;

            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = searchAdvancements(id, category, false, true, 1);

            advancementTitle = advancement[0]?.name ?? message;
            advancementDesc = advancement[0]?.description ?? keys.commands.advancements.no_description_available;

            // Add placeholder to argPlaceholder so it can be used later
            argPlaceholder.advancement_title = advancementTitle;
            argPlaceholder.advancement_description = advancementDesc;
        }

        const chatEmbed = getEmbed(keys.api.plugin.success.messages[type], argPlaceholder, ph.emojisAndColors(), { 'timestamp_now': Date.now() });
        if(type !== 'chat') {
            for(const channel of channels) {
                if(!server.chatChannels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

                /** @type {?Discord.TextChannel} */
                let discordChannel;
                try {
                    discordChannel = await guild.channels.fetch(channel.id);
                    if(!discordChannel) continue;
                    await discordChannel?.send({ embeds: [chatEmbed] });
                }
                catch(err) {
                    if(err.code === 10003) {
                        const regChannel = await server.protocol.removeChatChannel(channel);
                        if(!regChannel) continue;
                        await server.edit({ chatChannels: regChannel.data });
                    }
                }
            }
            return;
        }

        //type === 'chat'

        //Parse pings (@name)
        const mentions = message.match(/@(\S+)/g);
        for(const mention of mentions ?? []) {
            const users = await guild.members.search({ query: mention.replace('@', '') });
            argPlaceholder.message = argPlaceholder.message.replace(mention, users.first()?.toString() ?? mention);
        }

        const allWebhooks = await guild.fetchWebhooks().catch(() => {});

        for(const channel of channels) {
            if(!server.chatChannels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

            /** @type {?Discord.TextChannel} */
            let discordChannel;
            try {
                discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;
            }
            catch(err) {
                if(err.code === 10003) {
                    const regChannel = await server.protocol.removeChatChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ chatChannels: regChannel.data });
                }
                continue;
            }

            if(!allWebhooks) {
                await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojisAndColors())] });
                return;
            }

            if(!channel.webhook) {
                await discordChannel.send({ embeds: [chatEmbed] }).catch(() => {});
                continue;
            }

            try {
                let webhook = allWebhooks.get(channel.webhook);

                //Create new webhook if old one doesn't exist
                if(!webhook) {
                    const options = {
                        name: 'MC Linker',
                        reason: 'ChatChannel to Minecraft',
                        avatar: 'https://mclinker.com/assets/mclinkerlogo.png',
                    };
                    if(discordChannel.isThread()) webhook = await discordChannel.parent.createWebhook(options);
                    else webhook = await discordChannel.createWebhook(options);

                    const regChannel = await server.protocol.addChatChannel({
                        types: channel.types,
                        webhook: webhook.id,
                        id: channel.id,
                    });
                    if(!regChannel) {
                        await discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook, ph.emojisAndColors())] });
                        await webhook.delete();
                        return;
                    }

                    await server.edit({ chatChannels: regChannel.data });
                }

                if(discordChannel.isThread()) await webhook.send({
                    threadId: discordChannel.id,
                    content: argPlaceholder.message,
                    username: player,
                    avatarURL: authorURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });
                else await webhook.send({
                    content: argPlaceholder.message,
                    username: player,
                    avatarURL: authorURL,
                    allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                });
            }
            catch(_) {
                try {
                    if(discordChannel.permissionsFor(guild.members.me).has(Discord.PermissionFlagsBits.ManageWebhooks)) {
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojisAndColors())] });
                    }
                    else {
                        await discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.unknown_chat_error, ph.emojisAndColors())] });
                    }
                }
                catch(_) {
                    const regChannel = await server.protocol.removeChatChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ chatChannels: regChannel.data });
                }
            }
        }
    }

    /**
     * Handles stats-channel updates.
     * @param {Object} data - The request data.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<void>}
     * @private
     */
    async _updateStatsChannel(data, server) {
        // event can be one of: 'online', 'offline', 'members'
        const { channels, event } = data;

        const guild = await this.client.guilds.fetch(server.id);
        for(const channel of channels) {
            if(!channel.names[event]) return;

            /** @type {?Discord.TextChannel} */
            let discordChannel;
            try {
                discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;
            }
            catch(err) {
                if(err.code === 10003) {
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ statChannels: regChannel.data });
                }
                continue;
            }

            //Replace %count% with the actual count
            if(event === 'members') channel.names[event] = channel.names[event].replace('%count%', data.members);
            try {
                await discordChannel.setName(channel.names[event]);
            }
            catch(_) {}
        }
    }

    /**
     * Checks whether the minecraft-user has the required role to join the server.
     * @param {string} uuid - The uuid of the minecraft-user.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<'not_connected'|'error'|Boolean>} - Whether the user has the required role.
     */
    async _hasRequiredRoleToJoin(uuid, server) {
        if(!server.requiredRoleToJoin) return true;
        const user = this.client.userConnections.cache.find(u => u.uuid === uuid);
        if(!user) return 'not_connected';

        const guild = await this.client.guilds.fetch(server.id);
        if(!guild) return 'error';

        const member = await guild.members.fetch({ user: user.id, force: true });
        if(!member) return 'error';

        return member.roles.cache.has(server.requiredRoleToJoin);
    }

    /**
     * Listens to a dm message of the user containing the code to verify the user.
     * @param {Object} data - The request data.
     * @returns {Promise<void>}
     */
    _verifyUser(data) {
        this.usersAwaitingVerification.set(data.code, { uuid: data.uuid, username: data.username });
        setTimeout(() => this.usersAwaitingVerification.delete(data.code), 180_000);
    }

    /**
     * Returns an existing invite url or creates a new one if none exists.
     * @param {string} id - The id of the guild.
     * @returns {Promise<?string>} - The invite url.
     */
    async _getInviteUrl(id) {
        const guild = await this.client.guilds.fetch(id);
        if(!guild) return null;

        const invite = await guild.invites.fetch();
        if(invite?.size) return invite.first().url;
        else {
            /** @type {?Discord.BaseGuildTextChannel} */
            const channel = guild.channels.cache.find(c =>
                c.permissionsFor(guild.members.me).has(Discord.PermissionFlagsBits.CreateInstantInvite) && c.isTextBased(),
            );
            if(!channel) return null;
            const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
            return invite.url;
        }
    }

    async _updateSyncedRole(data, server) {
        const guild = await this.client.guilds.fetch(server.id);
        if(!guild) return;

        const users = data.players.map(uuid => {
            const id = this.client.userConnections.cache.find(conn => conn.uuid === uuid)?.id;
            if(!id) return;
            return id;
        }).filter(id => id);
        for(const user of users) await guild.members.fetch(user);

        const role = guild.roles.cache.get(data.id);
        if(!role) return;

        const membersToRemove = role.members.map(m => m.id).filter(id => !users.includes(id));
        const membersToAdd = users.filter(id => !role.members.has(id));

        for(const member of membersToRemove) {
            await role.members.get(member).roles.remove(role);
        }
        for(const member of membersToAdd) {
            await role.members.get(member).roles.add(role);
        }
    }
}
