// noinspection HttpUrlsUsage
import Fastify from 'fastify';
import utils from './utils.js';
import { addPh, getEmbed, ph } from './messages.js';
import keys from './keys.js';
import config from '../config.json' assert { type: 'json' };
import PluginProtocol from '../structures/PluginProtocol.js';

export default class BotAPI {
    constructor(client) {

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
    }

    async startServer() {
        this.fastify.post('/chat', async (request, reply) => {
            const message = request.body.message;
            const channels = request.body.channels;
            const guildId = request.body.id;
            const type = request.body.type;
            const player = request.body.player?.replaceAll(' ', '');
            const authorURL = `https://minotar.net/helm/${player}/64.png`;
            const argPlaceholder = { ip: request.body.ip, 'username': player, 'author_url': authorURL, message };

            const ip = request.body.ip.split(':')[0];
            const port = request.body.ip.split(':')[1];
            /** @type {ServerConnection} */
            const server = this.client.serverConnections.cache.find(server => server.id === guildId && server.ip === ip && server.port === port && server.protocol instanceof PluginProtocol);

            //If no connection on that guild
            if(!server) return reply.status(403).send();
            else reply.send({ message: 'Success' });

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
                let mentions = message.match(/@(\S+)/g);
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
                    const discordChannel = await this.client.channels.fetch(channel.id);
                    if(!discordChannel) continue;

                    if(!allWebhooks) {
                        discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojis())] });
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
                            id: guildId,
                        });
                        if(!regChannel) {
                            discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook, ph.emojis())] });
                            await webhook.delete();
                            return;
                        }


                        await server.edit({ channels: regChannel.data.channels });
                    }

                    //Edit webhook if name doesnt match
                    if(webhook.name !== player) {
                        await webhook.edit({ name: player, avatar: authorURL });
                    }

                    if(discordChannel.isThread()) await webhook.send({
                        threadId: discordChannel.id,
                        content: argPlaceholder.message,
                    });
                    else await webhook.send(argPlaceholder.message);
                }
                return;
            }
            else {
                chatEmbed = getEmbed(keys.api.plugin.success.messages[type], argPlaceholder, ph.emojis(), { 'timestamp_now': Date.now() });
            }

            try {
                for(const channel of channels) {
                    const discordChannel = await this.client.channels.fetch(channel.id);
                    await discordChannel?.send({ embeds: [chatEmbed] })
                        .catch(() => {});
                }
            }
            catch(_) {}
        });

        //Returns latest version
        this.fastify.get('/version', () => config.pluginVersion);
        //Root endpoint
        this.fastify.get('/', () => keys.api.plugin.success.root_response);

        this.fastify.listen({ port: config.botPort, host: '0.0.0.0' }, (err, address) => {
            if(err) throw err;
            console.log(addPh(keys.api.plugin.success.listening.console, { address }));
        });
        return this.fastify;
    }
}
