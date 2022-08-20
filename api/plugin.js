// noinspection HttpUrlsUsage

const fetch = require('node-fetch');
const fs = require('fs-extra');
const crypto = require('crypto');
const Fastify = require('fastify');
const Discord = require('discord.js');
const utils = require('./utils');
const { keys, addPh, ph, getEmbed, defaultMessage } = require('./messages');
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
                    await client.channels.cache.get(channel.id)?.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), argPlaceholder))
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
            const guild = client.guilds.cache.get(guildId);

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
                const discordChannel = client.channels.cache.get(channel.id);

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
                        webhook.delete();
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
                await client.channels.cache.get(channel.id)?.send({ embeds: [chatEmbed] })
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

async function chat(message) {
    //Find conn with same guild id and channel with same id
    const conn = pluginConnections.find(conn => {
        if(conn.guildId === message.guildId) {
            return conn?.channels?.find(channel => channel.id === message.channel.id);
        }
        return false;
    });

    let content = message.cleanContent;
    message.attachments?.forEach(attach => content += `\n${attach.url}`);

    const chatJson = {
        'msg': content.replaceAll('\u200B', ''),
        'username': message.author.username,
        'private': false,
    };

    if(conn?.chat && !message.author.bot) {
        try {
            await fetch(`http://${conn.ip}/chat/`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${conn.hash}`,
                },
                body: JSON.stringify(chatJson),
            });
            return true;
        }
        catch(err) {
            return false;
        }
    }
}

async function chatPrivate(msg, credentials, username, target, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(credentials, message);
        if(!ip || !hash) return resolve(false);

        const chatJson = {
            'msg': msg.replaceAll('\u200B', ''),
            'username': username,
            'private': true,
            'target': target,
        };

        try {
            const resp = await fetch(`http://${ip}/chat/`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${hash}`,
                },
                body: JSON.stringify(chatJson),
            });

            if(!await checkStatus(resp, message)) return resolve(false);

            resolve({ message: await resp.text(), status: resp.status });
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function connect(ip, guildId, verifyCode, message = defaultMessage) {
    return new Promise(async resolve => {
        const hash = crypto.randomBytes(32).toString('base64');

        const connectJson = {
            'ip': ip,
            'chat': false,
            'guild': guildId,
        };

        pluginConnections = await fs.readJson('./serverdata/connections/connections.json', 'utf-8');
        const conn = pluginConnections.find(conn => conn.guildId === guildId);
        const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);

        //Disconnect from old server
        if(conn && conn.ip !== ip) {
            try {
                const resp = await fetch(`http://${conn.ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${conn.hash}`,
                    },
                });
                if(!resp.ok) message.channel.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), { 'ip': conn.ip }));
                else message.channel.send(addPh(keys.api.plugin.warnings.automatically_disconnected, ph.emojis(), { 'ip': conn.ip }));
            }
            catch(err) {
                message.channel.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), { 'ip': conn.ip }));
            }
        }
        //Remove old connection
        if(conn) pluginConnections.splice(connIndex, 1);

        try {
            let resp = await fetch(`http://${ip}/connect/`, {
                method: 'POST',
                body: JSON.stringify(connectJson),
                headers: {
                    Authorization: `Basic ${verifyCode}, Basic ${hash}`,
                    'Content-Type': 'application/json',
                },
            });
            if(resp.status === 401) return resolve(401);
            else if(!await checkStatus(resp, message)) return resolve(false);
            resp = await resp.json();

            pluginConnections.push({
                'guildId': guildId,
                'hash': resp.hash,
                'chat': false,
                'ip': ip,
            });
            const update = await updateConn(message);
            if(!update) {
                resolve(false);
                //Try to disconnect
                fetch(`http://${ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${hash}`,
                    },
                }).catch(() => {});
            }
            else resolve(resp);
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function disconnect(guildId, client, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(guildId, message);
        if(!ip || !hash) return resolve(false);

        try {
            pluginConnections = await fs.readJson('./serverdata/connections/connections.json', 'utf-8');
            const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);

            if(connIndex === -1) {
                message.respond(keys.api.plugin.warnings.not_connected);
                return resolve(false);
            }

            const resp = await fetch(`http://${ip}/disconnect/`, {
                headers: {
                    Authorization: `Basic: ${hash}`,
                },
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            const conn = pluginConnections[connIndex];
            for(const channel of conn?.channels ?? []) {
                //Delete webhook
                if(channel.webhook) {
                    const allWebhooks = await client.guilds.cache.get(guildId).fetchWebhooks();
                    allWebhooks.get(channel.webhook).delete();
                }
            }

            //Remove connection
            pluginConnections.splice(connIndex, 1);

            const update = await updateConn(message);
            resolve(update);
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function unregisterChannel(ip, guildId, channelId, client, message = defaultMessage) {
    return new Promise(async resolve => {
        const hash = await utils.getHash(guildId, message);
        if(!hash) return resolve(false);

        pluginConnections = await fs.readJson('./serverdata/connections/connections.json', 'utf-8');

        //Find connection
        const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);
        if(connIndex === -1) {
            message.respond(keys.api.plugin.warnings.not_connected);
            resolve(false);
            return;
        }

        const conn = pluginConnections[connIndex];
        const channel = conn.channels.find(c => c.id === channelId);
        if(!channel) {
            message.respond(keys.api.plugin.warnings.channel_not_added);
            resolve(false);
            return;
        }

        const connectJson = {
            'guild': guildId,
            'ip': ip,
            'channel': channel,
        };

        try {
            let resp = await fetch(`http://${ip}/channel/remove`, {
                method: 'POST',
                body: JSON.stringify(connectJson),
                headers: {
                    Authorization: `Basic ${hash}`,
                    'Content-Type': 'application/json',
                },
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            resp = await resp.json();

            //Delete webhook
            if(channel.webhook) {
                const allWebhooks = await client.guilds.cache.get(guildId).fetchWebhooks();
                allWebhooks.get(channel.webhook).delete();
            }

            //Remove connection
            pluginConnections.splice(connIndex, 1);

            if(!conn?.channels) {
                conn.channels = [];
                conn.chat = false;
            }
            //Remove channel
            const channelIndex = conn.channels.findIndex(c => c === channel);
            conn.channels.splice(channelIndex, 1);

            //Push new conn
            pluginConnections.push(conn);

            const update = await updateConn(message);
            if(!update) {
                resolve(false);
                //Try to disconnect
                fetch(`http://${ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${hash}`,
                    },
                }).catch(() => {});
            }
            else resolve(resp);
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function registerChannel(guildId, channelId, types, webhookId, client, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(guildId, message);
        if(!ip || !hash) return resolve(false);

        const connectJson = {
            'guild': guildId,
            'ip': ip,
            'channel': {
                'id': channelId,
                'types': [],
            },
        };

        //Create webhook and add it to connectJson
        if(webhookId) connectJson.channel.webhook = webhookId;

        //Push types to channel option
        types.forEach(type => connectJson.channel.types.push(type));

        pluginConnections = await fs.readJson('./serverdata/connections/connections.json', 'utf-8');

        try {
            let resp = await fetch(`http://${ip}/channel/add`, {
                method: 'POST',
                body: JSON.stringify(connectJson),
                headers: {
                    Authorization: `Basic ${hash}`,
                    'Content-Type': 'application/json',
                },
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            resp = await resp.json();

            //Find connection
            const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);
            if(connIndex === -1) {
                message.respond(keys.api.plugin.warnings.not_connected);
                resolve(false);
                return;
            }

            //Get conn and then delete it
            const conn = pluginConnections[connIndex];
            pluginConnections.splice(connIndex, 1);

            if(!conn?.channels) {
                conn.channels = [];
                conn.chat = true;
            }

            //Remove channel with same id and set new channel
            const channelIndex = conn.channels.findIndex(c => c.id === connectJson.channel.id);
            if(channelIndex !== -1) {
                const channel = conn.channels[channelIndex];
                if(channel.webhook) {
                    const allWebhooks = await client.guilds.cache.get(guildId).fetchWebhooks();
                    allWebhooks.get(channel.webhook)?.delete();
                }

                conn.channels.splice(channelIndex, 1);
            }

            //Push new channel
            conn.channels.push(connectJson.channel);

            //Push new conn
            pluginConnections.push(conn);

            const update = await updateConn(message);
            if(!update) {
                resolve(false);
                //Try to disconnect
                fetch(`http://${ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${hash}`,
                    },
                }).catch(() => {});
            }
            else resolve(resp);
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function get(getPath, putPath, credentials, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(credentials, message);
        if(!ip || !hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/file/get/?path=${getPath}`, {
                headers: {
                    Authorization: `Basic ${hash}`,
                },
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            await fs.ensureFile(putPath);
            const fileStream = fs.createWriteStream(putPath);
            resp.body.pipe(fileStream);

            resp.body.on('error', err => {
                message.respond(keys.api.plugin.errors.could_not_stream, { 'path': getPath, 'error': err });
                resolve(false);
            });
            fileStream.on('finish', async () => {
                message.respond(keys.api.plugin.success.get, { 'path': getPath });

                resolve(await fs.readFile(putPath));
            });
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function put(getPath, putPath, credentials, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(credentials, message);
        if(!ip || !hash) return resolve(false);

        try {
            let readStream = fs.createReadStream(getPath);
            const fileStats = await fs.stat(getPath);

            const resp = await fetch(`http://${ip}/file/put/?path=${putPath}`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${hash}`,
                    'Content-length': fileStats.size,
                },
                body: readStream,
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            message.respond(keys.api.plugin.success.put, { 'path': putPath });
            resolve(true);
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

async function list(folder, credentials, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(credentials, message);
        if(!ip || !hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/file/list/?folder=${encodeURIComponent(folder)}`, {
                headers: {
                    Authorization: `Basic ${hash}`,
                },
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            resolve(resp.json());
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function execute(command, credentials, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(credentials, message);
        if(!ip || !hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/command/?cmd=${encodeURIComponent(command)}`, {
                headers: {
                    Authorization: `Basic ${hash}`,
                },
            });

            if(!await checkStatus(resp, message)) return resolve(false);

            resolve({ json: await resp.json(), status: resp.status });
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function getOnlinePlayers(credentials, message = defaultMessage) {
    return new Promise(async resolve => {
        let { ip, hash } = await getAuthentication(credentials, message);
        if(!ip || !hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/players/`, {
                headers: {
                    Authorization: `Basic ${hash}`,
                },
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            resolve(await resp.json());
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function verify(ip, message = defaultMessage) {
    return new Promise(async resolve => {
        try {
            const resp = await fetch(`http://${ip}/verify/`);
            if(!await checkStatus(resp, message)) return resolve(false);
            resolve(true);
        }
        catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

async function getAuthentication(credentials, message) {
    if(typeof credentials === 'string') {
        return {
            ip: await utils.getIp(credentials, message),
            hash: await utils.getHash(credentials, message),
        };
    }
    else if(typeof credentials === 'object') return { ip: credentials.ip, hash: credentials.hash };
    else return false;
}

async function updateConn(message = defaultMessage) {
    return new Promise(resolve => {
        fs.outputJson('./serverdata/connections/connections.json', pluginConnections, { spaces: 2 })
            .catch(err => {
                message.respond(keys.api.plugin.errors.could_not_update, ph.error(err));
                resolve(false);
            }).then(() => resolve(true));
    });
}

async function checkStatus(response, message = defaultMessage) {
    if(response.status === 400) {
        message.respond(keys.api.plugin.errors.status_400, { 'error': await response.text() });
        return false;
    }
    else if(response.status === 500) {
        message.respond(keys.api.plugin.errors.status_500, { 'error': await response.text() });
        return false;
    }
    else if(response.status === 404) {
        message.respond(keys.api.plugin.errors.status_404);
        return false;
    }
    else if(response.status === 401) {
        message.respond(keys.api.plugin.errors.status_401);
        return false;
    }
    else return !!response.ok;
}

module.exports = {
    loadExpress,
    chat,
    chatPrivate,
    connect,
    registerChannel,
    unregisterChannel,
    disconnect,
    get,
    put,
    list,
    execute,
    getOnlinePlayers,
    verify,
};