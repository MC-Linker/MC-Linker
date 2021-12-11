const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const utils = require('./utils');
const Discord = require('discord.js');
const express = require('express');

module.exports = {
    loadExpress: async function(client) {
        const app = express();
        app.use(express.json());

        app.post('/chat', async (req, res) => {
            res.send('Success');

            const player = req.body.player;
            const authorURL = `https://mc-heads.net/avatar/${player?.toLowerCase()}.png`;
            const message = req.body.message;
            const channel = req.body.channel;
            const guild = req.body.guild;

            const chatEmbed = new Discord.MessageEmbed();
            switch(req.body.type) {
                case 0:
                    //CHAT
                    chatEmbed.setAuthor(player, authorURL)
                    .setDescription(message)
                    .setColor('BLURPLE');
                    break;
                case 1:
                    //JOIN
                    chatEmbed.setAuthor(player, authorURL)
                    .setDescription(`<:join:905924638083784836> **${player}** joined the game`)
                    .setColor('YELLOW');
                    break;
                case 2:
                    //LEAVE
                    chatEmbed.setAuthor(player, authorURL)
                    .setDescription(`<:leave:905924638100557865> **${player}** left the game`)
                    .setColor('YELLOW');
                    break;
                case 3:
                    //ADVANCEMENT
                    let advancementTitle;
                    try {
                        if(message.startsWith('minecraft:recipes')) return;
                        const advancementKey = message.replaceAll('minecraft:', '').replaceAll('/', '.');
                        const langData = JSON.parse(await fs.promises.readFile('./lang/english.json', 'utf-8'));
                        advancementTitle = langData[`advancements.${advancementKey}.title`];
                    } catch(err) {
                        advancementTitle = message;
                    }
 
                    chatEmbed.setAuthor(player, authorURL)
                    .setDescription(`**${player}** has made the advancement: [**${advancementTitle}**]`)
                    .setColor('LUMINOUS_VIVID_PINK');
                    break;
                case 4:
                    //DEATH
                    chatEmbed.setAuthor(player, authorURL)
                    .setDescription('<:death:905924668735770674> ' + message)
                    .setColor('DARK_PURPLE');
                    break;
                case 5:
                    //COMMAND
                    chatEmbed.setAuthor(player, authorURL)
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

            client.channels.cache.get(channel)?.send({ embeds: [chatEmbed] });
        });

        app.listen(3100, () => console.log('Listening on port 3100'));
        return app;
    },

    chat: async function(message) {
        //TODO optimize
        fs.readFile(`./connections/servers/${message.guild.id}.json`, 'utf-8', async(err, pluginJson) => {
            if(err) return false;

            if(message.attachments.size) message.attachments.forEach(attach => message.content += `\n${attach.url}`);

            const pluginData = JSON.parse(pluginJson);
            if(pluginData.channel === message.channelId && !message.author.bot && pluginData.chat) {
                try {
                    await fetch(`http://${pluginData.ip}/chat/?hash=${pluginData.hash}&msg=${encodeURIComponent(message.content)}&username=${message.author.username}`);
                    return true;
                } catch(err) {
                    return false;
                }
            }
        });
    },

    connect: function(ip, guildId, channelId, types, message) {
        return new Promise(async resolve => {
            let hash = crypto.randomBytes(32).toString('base64');

            let connectJson = {
                "hash": encodeURIComponent(hash),
                "chat": false,
                "guild": guildId,
                "ip": ip
            };
            if(channelId) {
                connectJson.chat = true;
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

            try {
                const resp = await fetch(`http://${ip}/connect/`, {
                    method: 'POST',
                    body: JSON.stringify(connectJson),
                    headers: { 'Content-Type': 'application/json' }
                });


                if(!await checkStatus(resp, message)) { resolve(false); return; }
                resolve(resp.json());
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesnt respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });

    },

    disconnect: function(message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(message.guildId, message);
            if(!ip) { resolve(false); return; }
            const hash = await utils.getHash(message.guildId, message);
            if(!hash) { resolve(false); return; }

            try {
                const resp = await fetch(`http://${ip}/disconnect/?hash=${hash}&filler`);
                if(!await checkStatus(resp, message)) { resolve(false); return; }
                resolve(true);
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesnt respond. Please check if the server is online and the plugin enabled.');
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
                    console.log('Error downloading files', err);
                    resolve(false);
                });
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`File [${getPath}] successfully downloaded`);
                    resolve(true);
                });
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesnt respond. Please check if the server is online and the plugin enabled.');
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

                console.log(`File [${getPath}] successfully uploaded`);
                resolve(true);
            } catch(err) {
                message.reply('<:Error:849215023264169985> Plugin doesnt respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });

    },

    find: async function(start, maxDepth, file, message) {
        return new Promise(async resolve => {
            const ip = await utils.getIp(message.guildId, message);
            if (!ip) return;
            const hash = await utils.getHash(message.guildId, message);
            if (!hash) return;

            try {
                const resp = await fetch(`http://${ip}/file/find/?hash${hash}&file=${file}&path=${start}&depth=${maxDepth}`);
                if (!await checkStatus(resp, message)) return;
                return resp.text();
            } catch (err) {
                message.reply('<:Error:849215023264169985> Plugin doesnt respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
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
                message.reply('<:Error:849215023264169985> Plugin doesnt respond. Please check if the server is online and the plugin enabled.');
                console.log('Plugin doesnt respond');
                resolve(false);
            }
        });
    }
}

async function checkStatus(response, message) {
    if(response.status === 400) {
        console.log('A client error occurred: ' + await response.text())
        message.reply('<:Error:849215023264169985> An unknown client error occurred');
        return false;
    } else if(response.status === 500) {
        console.log('A server error occurred: ' + await response.text())
        message.reply('<:Error:849215023264169985> The User never joined the server or the world path is incorrect.');
        return false;
    } else if(response.ok) return true;
}