// noinspection HttpUrlsUsage

const fs = require('fs-extra');
const Fastify = require('fastify');
const utils = require('./utils');
const { keys, addPh, ph, getEmbed } = require('./messages');
const { botPort, pluginVersion } = require('../config.json');

let pluginConnections = [];

async function loadExpress(client) {
    pluginConnections = await fs.readJson('./serverdata/connections/connections.json', 'utf-8');
    const fastify = Fastify();

    const alreadyWarnedServers = []; //Only warn for the same server once each restart

    fastify.post('/chat', async (request, reply) => {
        reply.send('Success');

        const player = request.body.player?.replaceAll(' ', '');
        const authorURL = `https://minotar.net/helm/${player}/64.png`;
        const message = request.body.message;
        const channels = request.body.channels;
        const guildId = request.body.guild;
        const ip = request.body.ip;
        const argPlaceholder = { ip, 'username': player, 'author_url': authorURL, message };

        //Get connection JSON of guild
        const conn = pluginConnections.find(conn => conn.guildId === guildId && conn.ip === ip);

        //If no connection on that ip and not already warned
        if(!conn && !alreadyWarnedServers.includes(guildId)) {
            try {
                for(const channel of channels) {
                    const discordChannel = await client.channels.fetch(channel);
                    await discordChannel?.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), argPlaceholder))
                        .catch(() => {});
                }

                alreadyWarnedServers.push(guildId);
                return;
            }
            catch(ignored) {}
        }

        let chatEmbed;

        if(request.body.type === 'advancement') {
            let advancementTitle;
            let advancementDesc;

            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = await utils.searchAdvancements(id, category, false, true, 1);

            advancementTitle = advancement[0]?.name;
            advancementDesc = advancement[0]?.description;

            if(!advancementDesc) advancementDesc = keys.commands.advancements.no_description_available;
            if(!advancementTitle) advancementTitle = message;

            chatEmbed = getEmbed(keys.api.plugin.success.messages.advancement, argPlaceholder, {
                'advancement_title': advancementTitle,
                'advancement_description': advancementDesc,
            });
        }
        else if(request.body.type === 'chat') {
            const guild = await client.guilds.fetch(guildId);

            //Parse pings (@name)
            let mentions = message.match(/@(\S+)/g);
            for(const mention of mentions ?? []) {
                const users = await guild.members.search({ query: mention.replace('@', '') });
                argPlaceholder.message = argPlaceholder.message.replace(mention, users.first()?.toString() ?? mention);
            }

            chatEmbed = getEmbed(keys.api.plugin.success.messages.chat, argPlaceholder, ph.emojis());

            let allWebhooks;
            //Fetch all webhooks in guild
            try {
                allWebhooks = await guild.fetchWebhooks();
            }
            catch(err) {}

            for(const channel of channels) {
                const discordChannel = await client.channels.fetch(channel.id);

                if(!allWebhooks) {
                    discordChannel?.send({ embeds: [getEmbed(keys.api.plugin.errors.no_webhook_permission, ph.emojis())] });
                    return;
                }

                if(!channel.webhook) {
                    try {
                        discordChannel?.send({ embeds: [chatEmbed] })
                            .catch(() => {});
                    }
                    catch(ignored) {}
                    continue;
                }

                let webhook = allWebhooks.get(channel.webhook);

                //Create new webhook if old one doesn't exist
                if(!webhook) {
                    if(discordChannel.isThread()) webhook = await discordChannel.parent.createWebhook({
                        name: player,
                        reason: 'ChatChannel to Minecraft',
                        avatar: authorURL,
                    });
                    else webhook = await discordChannel.createWebhook({
                        name: player,
                        reason: 'ChatChannel to Minecraft',
                        avatar: authorURL,
                    });

                    //Fake interaction
                    discordChannel.respond = () => discordChannel.send({ embeds: [getEmbed(keys.api.plugin.errors.could_not_add_webhook, ph.emojis())] });

                    const regChannel = await registerChannel(guildId, channel.id, channel.types, webhook.id, message.client, discordChannel);
                    if(!regChannel) {
                        await webhook.delete();
                        return;
                    }

                    const pluginJson = {
                        'ip': regChannel.ip,
                        'version': regChannel.version.split('.')[1],
                        'path': regChannel.path,
                        'hash': regChannel.hash,
                        'guild': regChannel.guild,
                        'chat': true,
                        'channels': regChannel.channels,
                        'protocol': 'plugin',
                    };

                    fs.outputJson(`./serverdata/connections/${guildId}/connection.json`, pluginJson, { spaces: 2 }, err => {
                        if(err) {
                            webhook.delete();
                            discordChannel.send({ embeds: [getEmbed(keys.commands.chatchannel.errors.could_not_write_file)] });
                        }
                    });
                }

                //Edit webhook if name doesnt match
                if(webhook.name !== player) {
                    await webhook.edit({
                        name: player,
                        avatar: authorURL,
                    });
                }

                if(discordChannel.isThread()) webhook.send({
                    threadId: discordChannel.id,
                    content: argPlaceholder.message,
                });
                else webhook.send(argPlaceholder.message);
            }
            return;
        }
        else {
            chatEmbed = getEmbed(keys.api.plugin.success.messages[request.body.type], argPlaceholder, ph.emojis(), { 'timestamp_now': Date.now() });
        }

        //why not triple-catch (try/catch, .catch, optional chaining)
        try {
            for(const channel of channels) {
                const discordChannel = await client.channels.fetch(channel.id);
                await discordChannel?.send({ embeds: [chatEmbed] })
                    .catch(() => {
                    });
            }
        }
        catch(ignored) {
        }
    });

    //Returns latest version
    fastify.get('/version', () => pluginVersion);
    //Root endpoint
    fastify.get('/', () => keys.api.plugin.success.root_response);

    fastify.listen({ port: botPort, host: '0.0.0.0' }, (err, address) => {
        if(err) throw err;
        console.log(addPh(keys.api.plugin.success.listening.console, { address }));
    });
    return fastify;
}

module.exports = { loadExpress };