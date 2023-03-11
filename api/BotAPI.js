// noinspection HttpUrlsUsage
import Fastify from 'fastify';
import { getOAuthURL, getTokens, getUser } from './oauth.js';
import * as utils from './utils.js';
import { addPh, getEmbed, ph } from './messages.js';
import keys from './keys.js';
import { EventEmitter } from 'node:events';
import fastifyCookie from '@fastify/cookie';
import fastifyIO from 'fastify-socket.io';
import Discord from 'discord.js';

export default class BotAPI extends EventEmitter {

    /**
     * The websocket instance for the api.
     * @type {import('socket.io').Server}
     */
    websocket;

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
        function _getServerFastify(data, reply, client) {
            const id = data.id;
            const ip = data.ip.split(':')[0];
            const port = data.ip.split(':')[1];

            /** @type {ServerConnection} */
            const server = client.serverConnections.cache.find(server => server.id === id && server.ip === ip && server.port === port && server.hasHttpProtocol());

            //If no connection on that guild send disconnection status
            if(!server) return reply.status(403).send();
            else reply.send({});
        }

        this.fastify.post('/chat', (request, reply) => {
            const server = _getServerFastify(request.body, reply, this.client);
            if(!server) return;
            this._chat(request.body, server);
        });

        this.fastify.post('/update-stats-channels', (request, reply) => {
            const server = _getServerFastify(request.body, reply, this.client);
            if(!server) return;
            this._updateStatsChannel(request.body);
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
            const hash = utils.createHash(token);

            /** @type {?ServerConnection} */
            const server = this.client.serverConnections.cache.find(server => server.hasWebSocketProtocol() && server.hash === hash);
            if(!server) return socket.disconnect();

            socket.emit('auth-success', {}); //Tell the client that the auth was successful

            server.protocol.updateSocket(socket);
            this.addListeners(socket, server, hash);
        });

        this.client.emit('apiReady', this);
        return this.fastify;
    }

    addListeners(socket, server, hash) {
        socket.on('chat', async data => {
            const server = getServerWebsocket(this.client);
            if(!server) return;
            await this._chat(JSON.parse(data), server);
        });
        socket.on('update-stats-channels', async data => {
            const server = getServerWebsocket(this.client);
            if(!server) return;
            await this._updateStatsChannel(JSON.parse(data));
        });
        socket.on('disconnect', () => {
            server.protocol.updateSocket(null);
        });

        function getServerWebsocket(client) {
            //Update server variable to ensure it wasn't disconnected in the meantime
            /** @type {?ServerConnection} */
            const server = client.serverConnections.cache.find(server => server.hasWebSocketProtocol() && server.hash === hash);

            //If no connection on that guild, disconnect socket
            if(!server) {
                socket.disconnect();
                return;
            }
            return server;
        }
    }

    /**
     * Handles chat messages
     * @param {Object} data - The chat data
     * @param {ServerConnection} server - The server connection
     * @returns {Promise<void>}
     * @private
     */
    async _chat(data, server) {
        const { message, channels, id: guildId, type, player } = data;
        const authorURL = `https://minotar.net/helm/${player}/64.png`;

        const argPlaceholder = { username: player, author_url: authorURL, message };

        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type)) {
            const commandName = message.replace(/^\//, '').split(/\s+/)[0];
            if(server.settings.isDisabled('chat-commands', commandName)) return;
        }

        let chatEmbed;
        if(type === 'advancement') {
            let advancementTitle;
            let advancementDesc;

            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = utils.searchAdvancements(id, category, false, true, 1);

            advancementTitle = advancement[0]?.name ?? message;
            advancementDesc = advancement[0]?.description ?? keys.commands.advancements.no_description_available;

            chatEmbed = getEmbed(keys.api.plugin.success.messages.advancement, argPlaceholder, {
                'advancement_title': advancementTitle,
                'advancement_description': advancementDesc,
            });
        }
        else if(type === 'chat') {
            const guild = await this.client.guilds.fetch(guildId);

            //Parse pings (@name)
            const mentions = message.match(/@(\S+)/g);
            for(const mention of mentions ?? []) {
                const users = await guild.members.search({ query: mention.replace('@', '') });
                argPlaceholder.message = argPlaceholder.message.replace(mention, users.first()?.toString() ?? mention);
            }

            chatEmbed = getEmbed(keys.api.plugin.success.messages.chat, argPlaceholder, ph.emojis());

            let allWebhooks;
            try {
                allWebhooks = await guild.fetchWebhooks();
            }
            catch(_) {}

            for(const channel of channels) {
                if(!server.channels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

                const discordChannel = await guild.channels.fetch(channel.id);
                if(!discordChannel) continue;

                if(!allWebhooks) {
                    discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojis())] });
                    return;
                }

                if(!channel.webhook) {
                    try {
                        discordChannel.send({ embeds: [chatEmbed] })
                            .catch(() => {});
                    }
                    catch(_) {}
                    continue;
                }

                try {
                    let webhook = allWebhooks.get(channel.webhook);

                    //Create new webhook if old one doesn't exist
                    if(!webhook) {
                        const options = {
                            name: player,
                            reason: 'ChatChannel to Minecraft',
                            avatar: authorURL,
                        };

                        if(discordChannel.isThread()) webhook = await discordChannel.parent.createWebhook(options);
                        else webhook = await discordChannel.createWebhook(options);

                        const regChannel = await server.protocol.addChatChannel({
                            types: channel.types,
                            webhook: webhook.id,
                            id: channel.id,
                        });
                        if(!regChannel) {
                            discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook, ph.emojis())] });
                            await webhook.delete();
                            return;
                        }

                        await server.edit({ channels: regChannel.data });
                    }

                    //Edit webhook if name doesnt match
                    if(webhook.name !== player) {
                        await webhook.edit({ name: player, avatar: authorURL });
                    }

                    if(discordChannel.isThread()) await webhook.send({
                        threadId: discordChannel.id,
                        content: argPlaceholder.message,
                        allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                    });
                    else await webhook.send({
                        content: argPlaceholder.message,
                        allowedMentions: { parse: [Discord.AllowedMentionsTypes.User] },
                    });
                }
                catch(_) {
                    discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojis())] });
                    return;
                }
            }
            return;
        }
        else {
            chatEmbed = getEmbed(keys.api.plugin.success.messages[type], argPlaceholder, ph.emojis(), { 'timestamp_now': Date.now() });
        }

        try {
            for(const channel of channels) {
                if(!server.channels.some(c => c.id === channel.id)) continue; //Skip if channel is not registered

                const discordChannel = await this.client.channels.fetch(channel.id);
                if(!discordChannel) continue;

                try {
                    await discordChannel?.send({ embeds: [chatEmbed] });
                }
                catch(_) {}
            }
        }
        catch(_) {}
    }

    async _updateStatsChannel(data) {
        // event can be one of: 'online', 'offline', 'members'
        const { channels, event } = data;

        for(const channel of channels) {
            if(!channel.names[event]) return;

            const discordChannel = await this.client.channels.fetch(channel.id);
            if(!discordChannel) return;

            //Replace %count% with the actual count
            if(event === 'members') channel.names[event] = channel.names[event].replace('%count%', data.members);
            discordChannel.setName(channel.names[event]);
        }
    }
}
