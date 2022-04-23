const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const utils = require('./utils');
const { botPort, pluginVersion } = require('../config.json');
const { keys, addPh, ph, getEmbedBuilder } = require('./messages');

let pluginConnections = [];
async function loadExpress(client) {
    pluginConnections = JSON.parse(await fs.promises.readFile('./serverdata/connections/connections.json', 'utf-8'));
    const app = express();
    app.use(express.json());

    const alreadyWarnedServers = []; //Only warn for the same server once each restart

    app.post('/chat', async (req, res) => {
        res.send('Success');

        const player = req.body.player?.replaceAll(' ', '');
        const authorURL = `https://minotar.net/helm/${player}/64.png`;
        const message = req.body.message;
        const channel = req.body.channel;
        const guild = req.body.guild;
        const ip = req.body.ip;
        const argPlaceholder = { ip, "username": player, "author_url": authorURL, message };

        //Get connection JSON of guild
        const conn = pluginConnections.find(conn => conn.guildId === guild && conn.ip === ip);


        //If no connection on that ip
        if(!conn && alreadyWarnedServers.includes(conn.ip)) {
            try {
                await client.channels.cache.get(channel)?.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), argPlaceholder))
                    .catch(() => {});

                alreadyWarnedServers.push(conn.ip);
                return;
            } catch(ignored) {}
        }

        let chatEmbed;
        switch(req.body.type) {
            case "chat":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.chat, argPlaceholder);
                break;
            case "join":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.join, argPlaceholder, ph.emojis());
                break;
            case "leave":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.leave, argPlaceholder, ph.emojis());
                break;
            case "advancement":
                let advancementTitle;
                let advancementDesc;

                if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

                const advancementKey = message.replaceAll('minecraft:', '').split('/');
                const advancement = await utils.searchAdvancements(advancementKey[1], advancementKey[0], false, true, 1);

                advancementTitle = advancement[0]?.name;
                advancementDesc = advancement[0]?.description;

                if(!advancementDesc) advancementDesc = keys.commands.advancements.no_description_available;
                if(!advancementTitle) advancementTitle = message;

                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.advancement, argPlaceholder, { "advancement_title": advancementTitle, "advancement_description": advancementDesc });
                break;
            case "death":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.death, argPlaceholder, ph.emojis());
                break;
            case "command":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.command, argPlaceholder, ph.emojis());
                break;
            case "start":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.start, argPlaceholder, ph.emojis());
                break;
            case "stop":
                chatEmbed = getEmbedBuilder(keys.api.plugin.success.messages.stop, argPlaceholder, ph.emojis());
                break;
        }

        //why not triple-catch (try/catch, .catch, optional chaining) it
        try {
            await client.channels.cache.get(channel)?.send({ embeds: [chatEmbed] })
                .catch(() => {});
        } catch(ignored) {}
    });

    //Returns latest version
    app.get('/version', (req, res) => res.send(pluginVersion));

    app.get('/', (req, res) => res.send('To invite the Minecraft SMP Bot, open this link: <a href=https://top.gg/bot/712759741528408064 >https://top.gg/bot/712759741528408064</a>'));

    app.listen(botPort, function () { console.log(addPh(keys.api.plugin.success.listening.console, { "port": this.address().port })) });
    return app;
}

async function chat(message) {
    const conn = pluginConnections.find(conn => conn.guildId === message.guildId && conn.channelId === message.channelId);

    let content = message.cleanContent;
    message.attachments?.forEach(attach => content += `\n${attach.url}`);

    if(conn?.chat && !message.author.bot) {
        try {
            await fetch(`http://${conn.ip}/chat/?&msg=${encodeURIComponent(content.replaceAll('\u200B', ''))}&username=${message.author.username}`, {
                headers: {
                    Authorization: `Basic ${conn.hash}`
                }
            });
            return true;
        } catch(err) {
            return false;
        }
    }
}

function connect(ip, guildId, verifyCode, message) {
    return new Promise(async resolve => {
        const hash = crypto.randomBytes(32).toString('base64');

        const connectJson = {
            "ip": ip,
            "chat": false,
            "guild": guildId
        };

        pluginConnections = JSON.parse(await fs.promises.readFile('./serverdata/connections/connections.json', 'utf-8'));
        const conn = pluginConnections.find(conn => conn.guildId === guildId);
        const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);

        //Disconnect from old server
        if(conn && conn.ip !== ip) {
            try {
                const resp = await fetch(`http://${conn.ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${conn.hash}`
                    }
                });
                if(!resp.ok) message.channel.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), { "ip": conn.ip }));
                else message.channel.send(addPh(keys.api.plugin.warnings.automatically_disconnected, { "ip": conn.ip }));
            } catch(err) {
                message.channel.send(addPh(keys.api.plugin.warnings.not_completely_disconnected, ph.emojis(), { "ip": conn.ip }));
            } finally {
                pluginConnections.splice(connIndex, 1);
            }
        } else if(conn) pluginConnections.splice(connIndex, 1);

        try {
            let resp = await fetch(`http://${ip}/connect/`, {
                method: 'POST',
                body: JSON.stringify(connectJson),
                headers: {
                    Authorization: `Basic ${verifyCode}, Basic ${hash}`,
                    'Content-Type': 'application/json',
                }
            });
            if(resp.status === 401) return resolve(401);
            else if(!await checkStatus(resp, message)) return resolve(false);
            resp = await resp.json();

            pluginConnections.push({
                "guildId": guildId,
                "hash": resp.hash,
                "chat": false,
                "ip": ip,
            });
            const update = await updateConn(message);
            if(!update) {
                resolve(false);
                //Try to disconnect
                fetch(`http://${ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${hash}`
                    }
                }).catch(() => {});
            } else resolve(resp);
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}


function disconnect(guildId, message) {
    return new Promise(async resolve => {
        const ip = await utils.getIp(guildId, message);
        if(!ip) return resolve(false);
        const hash = await utils.getHash(guildId, message);
        if(!hash) return resolve(false);

        try {
            pluginConnections = JSON.parse(await fs.promises.readFile('./serverdata/connections/connections.json', 'utf-8'));
            const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);

            if(connIndex === -1) {
                message.respond(keys.api.plugin.warnings.not_connected);
                return;
            }

            const resp = await fetch(`http://${ip}/disconnect/`, {
                headers: {
                    Authorization: `Basic: ${hash}`
                }
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            pluginConnections.splice(connIndex, 1);

            const update = await updateConn(message);
            resolve(update);
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function registerChannel(ip, guildId, channelId, types, message) {
    return new Promise(async resolve => {
        if(!await checkProtocol(message.guildId, message)) return resolve(false);

        const hash = await utils.getHash(guildId, message);
        if(!hash) return resolve(false);

        const connectJson = {
            "chat": true,
            "guild": guildId,
            "channel": channelId,
            "ip": ip,
        };
        const typeArr = [];
        types.forEach(type => {
            typeArr.push({
                "type": type,
                "enabled": true
            });
        });
        connectJson.types = typeArr;

        pluginConnections = JSON.parse(await fs.promises.readFile('./serverdata/connections/connections.json', 'utf-8'));

        try {
            let resp = await fetch(`http://${ip}/channel/`, {
                method: 'POST',
                body: JSON.stringify(connectJson),
                headers: {
                    Authorization: `Basic ${hash}`,
                    'Content-Type': 'application/json',
                }
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            resp = await resp.json();

            const connIndex = pluginConnections.findIndex(conn => conn.guildId === guildId);
            if(connIndex !== -1) pluginConnections.splice(connIndex, 1);

            pluginConnections.push({
                "guildId": guildId,
                "channelId": channelId,
                "hash": resp.hash,
                "chat": true,
                "ip": ip,
            });

            const update = await updateConn(message);
            if(!update) {
                resolve(false);
                //Try to disconnect
                fetch(`http://${ip}/disconnect/`, {
                    headers: {
                        Authorization: `Basic ${hash}`
                    }
                }).catch(() => {});
            } else resolve(resp);
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function get(getPath, putPath, message) {
    return new Promise(async resolve => {
        if(!await checkProtocol(message.guildId, message)) return resolve(false);


        const ip = await utils.getIp(message.guildId, message);
        if(!ip) return resolve(false);
        const hash = await utils.getHash(message.guildId, message);
        if(!hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/file/get/?path=${getPath}`, {
                headers: {
                    Authorization: `Basic ${hash}`
                }
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            const fileStream = fs.createWriteStream(putPath);
            resp.body.pipe(fileStream);

            resp.body.on('error', err => {
                message.respond(keys.api.plugin.errors.could_not_stream, { "path": getPath, "error": err });
                resolve(false);
            });
            fileStream.on('finish', () => {
                fileStream.close();
                message.respond(keys.api.plugin.success.get, { "path": getPath });
                resolve(true);
            });
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function put(getPath, putPath, message) {
    return new Promise(async resolve => {
        if(!await checkProtocol(message.guildId, message)) return resolve(false);


        const ip = await utils.getIp(message.guildId, message);
        if(!ip) return resolve(false);
        const hash = await utils.getHash(message.guildId, message);
        if(!hash) return resolve(false);

        try {
            let readStream = fs.createReadStream(getPath);
            const resp = await fetch(`http://${ip}/file/put/?path=${putPath}`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${hash}`,
                    'Content-length': fs.statSync(getPath).size
                },
                body: readStream
            });
            if(!await checkStatus(resp, message)) return resolve(false);

            message.respond(keys.api.plugin.success.put, { "path": putPath });
            resolve(true);
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

async function find(start, maxDepth, file, message) {
    return new Promise(async resolve => {
        if(!await checkProtocol(message.guildId, message)) return resolve(false);


        const ip = await utils.getIp(message.guildId, message);
        if (!ip) return resolve(false);
        const hash = await utils.getHash(message.guildId, message);
        if (!hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/file/find/?file=${file}&path=${start}&depth=${maxDepth}`, {
                headers: {
                    Authorization: `Basic ${hash}`
                }
            });
            if (!await checkStatus(resp, message)) return resolve(false);
            resolve(resp.text());
        } catch (err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function execute(command, message) {
    return new Promise(async resolve => {
        if(!await checkProtocol(message.guildId, message)) return resolve(false);

        const ip = await utils.getIp(message.guildId, message);
        if(!ip) return resolve(false);
        const hash = await utils.getHash(message.guildId, message);
        if(!hash) return resolve(false);

        try {
            const resp = await fetch(`http://${ip}/command/?cmd=${encodeURIComponent(command)}`, {
                headers: {
                    Authorization: `Basic ${hash}`
                }
            });

            if(!await checkStatus(resp, message)) return resolve(false);
            resolve({ message: await resp.text(), status: resp.status });
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

function verify(ip, message) {
    return new Promise(async resolve => {
        try {
            const resp = await fetch(`http://${ip}/verify/`);
            if(!await checkStatus(resp, message)) return resolve(false);
            resolve(true);
        } catch(err) {
            message.respond(keys.api.plugin.errors.no_response);
            resolve(false);
        }
    });
}

async function checkProtocol(guildId, message) {
    if(await utils.getProtocol(guildId, message) !== 'plugin') {
        message.respond(keys.api.plugin.warnings.not_connected);
        return false;
    }
    return true;
}

async function updateConn(message) {
    return new Promise(resolve => {
        fs.promises.writeFile('./serverdata/connections/connections.json', JSON.stringify(pluginConnections, null, 2), 'utf-8')
            .catch(err => {
                message.respond(keys.api.plugin.errors.could_not_update, ph.fromError(err));
                resolve(false);
            }).then(() => resolve(true));
    });
}

async function checkStatus(response, message) {
    if(response.status === 400) {
        message.respond(keys.api.plugin.errors.status_400, { "error": await response.text() });
        return false;
    } else if(response.status === 500) {
        message.respond(keys.api.plugin.errors.status_500, { "error": await response.text() });
        return false;
    } else if(response.status === 404) {
        message.respond(keys.api.plugin.errors.status_404);
        return false;
    } else if(response.status === 401) {
        message.respond(keys.api.plugin.errors.status_401);
        return false;
    } else return !!response.ok;
}

module.exports = { loadExpress, chat, connect, registerChannel, disconnect, get, put, find, execute, verify };