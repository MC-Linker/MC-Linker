const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const Discord = require('discord.js');
const express = require('express');
const utils = require('./utils');
const { botPort, pluginVersion } = require('../config.json');

let pluginConnections = [];
module.exports = {
    loadExpress: async function(client) {
        pluginConnections = JSON.parse(await fs.promises.readFile('./connections/connections.json', 'utf-8'));
        const app = express();
        app.use(express.json());

        app.post('/chat', async (req, res) => {
            res.send('Success');

            const player = req.body.player?.replaceAll(' ', '');
            const authorURL = `https://minotar.net/helm/${player}/64.png`;
            const message = req.body.message;
            const channel = req.body.channel;
            const guild = req.body.guild;
            const ip = req.body.ip;

            const conn = pluginConnections.find(conn => conn.guildId === guild && conn.ip === ip);

            if(!conn) {
                try {
                    await client.channels.cache.get(channel)?.send(`:warning: The server [**${ip}**] is not completely disconnected. Please disconnect it manually by **deleting** the following file: \`Server Folder/plugins/SMP-Plugin/connection.conn\` or by **removing** the plugin completely.`);
                    return;
                } catch(ignored) {}
            }

            const chatEmbed = new Discord.MessageEmbed();
            switch(req.body.type) {
                case 0:
                    //CHAT
                    chatEmbed.setAuthor({ name: player, iconURL: authorURL })
                    .setDescription(message)
                    .setColor('BLURPLE');
                    break;
                case 1:
                    //JOIN
                    chatEmbed.setAuthor({ name: player, iconURL: authorURL })
                    .setDescription(`<:join:905924638083784836> **${player}** joined the game`)
                    .setColor('YELLOW');
                    break;
                case 2:
                    //LEAVE
                    chatEmbed.setAuthor({ name: player, iconURL: authorURL })
                    .setDescription(`<:leave:905924638100557865> **${player}** left the game`)
                    .setColor('YELLOW');
                    break;
                case 3:
                    //ADVANCEMENT
                    let advancementTitle;
                    let advancementDescription;
                    try {
                        if(message.startsWith('minecraft:recipes')) return;
                        const advancementKey = message.replaceAll('minecraft:', '').replaceAll('/', '.');
                        const langData = JSON.parse(await fs.promises.readFile('./lang/english.json', 'utf-8'));
                        advancementTitle = langData[`advancements.${advancementKey}.title`];
                        advancementDescription = langData[`advancements.${advancementKey}.description`];
                    } catch(ignored) {
                        advancementTitle = message;
                        advancementDescription = '';
                    }
                    if(!advancementDescription || !advancementTitle) {
                        advancementTitle = message;
                        advancementDescription = '';
                    }

                    chatEmbed.setAuthor({ name: player, iconURL: authorURL })
                    .setDescription(`**${player}** has made the advancement: [**${advancementTitle}**]\n*${advancementDescription}*`)
                    .setColor('LUMINOUS_VIVID_PINK');
                    break;
                case 4:
                    //DEATH
                    chatEmbed.setAuthor({ name: player, iconURL: authorURL })
                    .setDescription(`<:death:905924668735770674> ${message}`)
                    .setColor('DARK_PURPLE');
                    break;
                case 5:
                    //COMMAND
                    chatEmbed.setAuthor({ name: player, iconURL: authorURL })
                    .setDescription(`<a:pinging:891202470833946635> **${player}** has executed the command: [**${message}**]`)
                    .setColor('DARK_GOLD');
                    break;
                case 6:
                    //STARTUP
                    chatEmbed.setDescription(`:green_circle: **${message}**`)
                    .setTimestamp(Date.now())
                    .setColor('GREEN');
                    break;
                case 7:
                    //SHUTDOWN
                    chatEmbed.setDescription(`:red_circle: **${message}**`)
                    .setTimestamp(Date.now())
                    .setColor('RED');
                    break;
            }

            try {
                await client.channels.cache.get(channel)?.send({ embeds: [chatEmbed] });
            } catch(ignored) {}
        });

        app.get('/version', (req, res) => res.send(pluginVersion));

        app.get('/', (req, res) => res.send('To invite the Minecraft SMP Bot, open this link: <a href=https://top.gg/bot/712759741528408064>https://top.gg/bot/712759741528408064<a/>'))

        app.listen(botPort, function () { console.log(`Listening on port ${this.address().port}`) });
        return app;
    },

    chat: async function(message) {
        const conn = pluginConnections.find(conn => conn.guildId === message.guildId && conn.channelId === message.channelId);
        if(message.attachments.size) message.attachments.forEach(attach => message.content += `\n${attach.url}`);

        if(conn && conn.chat && !message.author.bot) {
            try {
                await fetch(`http://${conn.ip}/chat/?hash=${conn.hash}&msg=${encodeURIComponent(message.content)}&username=${message.author.username}`);
                return true;
            } catch(err) {
                return false;
            }
        }
    },

    connect: function(ip, guildId, channelId, types, message) {
        return new Promise(async resolve => {
            const hash = crypto.randomBytes(32).toString('base64');

            const shouldChat = !!channelId;
            let connectJson = {
                "hash": encodeURIComponent(hash),
                "chat": shouldChat,
                "guild": guildId,
                "ip": ip
            };
            if(shouldChat) {
                connectJson.channel = channelId;
                const typeArr = [];
                types.forEach(type => {
                    typeArr.push({
                        "type": type,
                        "enabled": true
                    });
                });
                connectJson.types = typeArr;
            }

            const connections = JSON.parse(await fs.promises.readFile('./connections/connections.json', 'utf-8'));
            const conn = connections.find(conn => conn.guildId === guildId);
            const connIndex = connections.findIndex(conn => conn.guildId === guildId);

            if(conn && !shouldChat && conn.ip !== ip) {
                try {
                    const resp = await fetch(`http://${conn.ip}/disconnect/?hash=${conn.hash}&filler`);
                    if(!resp.ok) message.channel.send(`:warning: The old server [**${conn.ip}**] could not be completely disconnected. Please disconnect it manually by **deleting** the following file: \`Server Folder/plugins/SMPBotPlugin/connection.conn\` or by **removing** the plugin completely.`);
                    else message.channel.send(`:warning: Automatically disconnected from the old server [**${conn.ip}**] to ensure no complications happen.`);
                } catch(err) {
                    message.channel.send(`:warning: The old server [**${conn.ip}**] could not be completely disconnected. Please disconnect it manually by **deleting** the following file: \`Server Folder/plugins/SMPBotPlugin/connection.conn\` or by **removing** the plugin completely.`);
                } finally {
                    pluginConnections.splice(connIndex, 1);
                    connections.splice(connIndex, 1);
                }
            } else if(conn) {
                pluginConnections.splice(connIndex, 1);
                connections.splice(connIndex, 1);
            }

            try {
                const resp = await fetch(`http://${ip}/connect/`, {
                    method: 'POST',
                    body: JSON.stringify(connectJson),
                    headers: { 'Content-Type': 'application/json' }
                });

                if(!await checkStatus(resp, message)) { resolve(false); return; }

                pluginConnections.push({
                    "guildId": guildId,
                    "channelId": channelId,
                    "hash": encodeURIComponent(hash),
                    "chat": shouldChat,
                    "ip": ip,
                });
                connections.push({
                    "guildId": guildId,
                    "channelId": channelId,
                    "hash": encodeURIComponent(hash),
                    "chat": shouldChat,
                    "ip": ip,
                });
                fs.promises.writeFile('./connections/connections.json', JSON.stringify(connections, null, 2), 'utf-8')
                    .catch(err => {
                        message.reply('<:Error:849215023264169985> Couldn\'t save connection. Please try again.');
                        console.log('Couldn\'t save connections', err);
                        resolve(false);
                    }).then(() => resolve(resp.json()));
            } catch(err) {
                console.log(err)
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });

    },

    disconnect: function(guildId, message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(guildId, message);
            if(!ip) { resolve(false); return; }
            const hash = await utils.getHash(guildId, message);
            if(!hash) { resolve(false); return; }

            try {
                const connections = JSON.parse(await fs.promises.readFile('./connections/connections.json', 'utf-8'));
                const conn = connections.find(conn => conn.guildId === guildId);
                const connIndex = connections.findIndex(conn => conn.guildId === guildId);

                if(!conn) {
                    console.log('Not connected');
                    message.reply(':warning: You are not connected with the plugin!');
                    return;
                }

                const resp = await fetch(`http://${ip}/disconnect/?hash=${hash}&filler`);
                if(!await checkStatus(resp, message)) { resolve(false); return; }

                pluginConnections.splice(connIndex, 1);
                connections.splice(connIndex, 1);

                fs.promises.writeFile('./connections/connections.json', JSON.stringify(connections), 'utf-8')
                    .catch(err => {
                        message.reply('<:Error:849215023264169985> Couldn\'t disconnect from the plugin. Please try again.');
                        console.log('Couldn\'t save connections', err);
                        resolve(false);
                    }).then(() => resolve(true));
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });
    },

    get: function(getPath, putPath, message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(message.guildId, message);
            if(!ip) { resolve(false); return; }
            const hash = await utils.getHash(message.guildId, message);
            if(!hash) { resolve(false); return; }

            try {
                const resp = await fetch(`http://${ip}/file/get/?hash=${hash}&path=${getPath}`);
                if(!await checkStatus(resp, message)) { resolve(false); return; }

                const fileStream = fs.createWriteStream(putPath);
                resp.body.pipe(fileStream);

                resp.body.on('error', err => {
                    message.reply('<:Error:849215023264169985> Error while downloading files. Please try again.');
                    console.log(`Error saving file [${decodeURIComponent(getPath)}]`, err);
                    resolve(false);
                });
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`File [${decodeURIComponent(getPath)}] successfully downloaded`);
                    resolve(true);
                });
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });

    },

    put: function(getPath, putPath, message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(message.guildId, message);
            if(!ip) { resolve(false); return; }
            const hash = await utils.getHash(message.guildId, message);
            if(!hash) { resolve(false); return; }

            try {
                let readStream = fs.createReadStream(getPath);
                const resp = await fetch(`http://${ip}/file/put/?hash=${hash}&path=${putPath}`, {
                    method: 'POST',
                    headers: {
                        "Content-length": fs.statSync(getPath).size
                    },
                    body: readStream
                });
                if(!await checkStatus(resp, message)) { resolve(false); return; }

                console.log(`File [${decodeURIComponent(getPath)}] successfully uploaded`);
                resolve(true);
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });

    },

    find: async function(start, maxDepth, file, message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(message.guildId, message);
            if (!ip) { resolve(false); return; }
            const hash = await utils.getHash(message.guildId, message);
            if (!hash) { resolve(false); return; }

            try {
                const resp = await fetch(`http://${ip}/file/find/?hash${hash}&file=${file}&path=${start}&depth=${maxDepth}`);
                if (!await checkStatus(resp, message)) { resolve(false); return; }
                resolve(resp.text());
            } catch (err) {
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });
    },

    execute: function(command, message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(message.guildId, message);
            if(!ip) { resolve(false); return; }
            const hash = await utils.getHash(message.guildId, message);
            if(!hash) { resolve(false); return; }

            try {
                const resp = await fetch(`http://${ip}/command/?hash=${hash}&cmd=${encodeURIComponent(command)}`);
                if(!await checkStatus(resp, message)) { resolve(false); return; }
                resolve(true);
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });
    },

    log: function(ip, logMessage, message) {
        return new Promise(async resolve => {
            try {
                const hash = crypto.randomBytes(32).toString('base64');

                const resp = await fetch(`http://${ip}/log/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "message": logMessage,
                        "hash": encodeURIComponent(hash)
                    })
                });

                if(!await checkStatus(resp, message)) { resolve(false); return; }
                resolve(true);
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesn\'t respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });
    }
}

async function checkStatus(response, message) {
    if(response.status === 400 || response.status === 404) {
        console.log(`A client error occurred: ${await response.text()}`);
        message.reply('<:Error:849215023264169985> An unknown client error occurred');
        return false;
    } else if(response.status === 500) {
        console.log(`A server error occurred:  ${await response.text()}`);
        message.reply('<:Error:849215023264169985> The User never joined the server or the world path is incorrect.');
        return false;
    } else return !!response.ok;
}