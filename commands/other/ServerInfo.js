const Command = require('../../structures/Command');
const { keys } = require('../../api/keys');
const Protocol = require('../../structures/Protocol');
const path = require('path');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const { addPh, getComponent, getReplyOptions } = require('../../api/messages');
const Canvas = require('@napi-rs/canvas');
const fs = require('fs-extra');
const Pagination = require('../../structures/helpers/Pagination');


class ServerInfo extends Command {

    constructor() {
        super({
            name: 'serverinfo',
            category: 'other',
        });
    }


    async execute(interaction, client, args, server) {
        if(!super.execute(interaction, client, args, server)) return;

        const serverPath = path.dirname(server.path); //TODO add serverpath property to connections
        let serverProperties = await server.protocol.get(Protocol.FilePath.ServerProperties(serverPath), `./serverdata/connections/${server.id}/server.properties`);
        let levelDat = await server.protocol.get(Protocol.FilePath.LevelDat(server.path), `./serverdata/connections/${server.id}/level.dat`);
        let serverIcon = await server.protocol.get(Protocol.FilePath.ServerIcon(serverPath), `./serverdata/connections/${server.id}/server-icon.png`);

        //TODO add method to perform multiple requests at once (for ftp efficiency)
        if(!await utils.handleProtocolResponses([serverProperties, levelDat], server.protocol, interaction, {
            404: addPh(keys.api.command.errors.could_not_download, { category: 'server-info' }),
        })) return;

        const datObject = await utils.nbtBufferToObject(levelDat.data, interaction);
        if(!datObject) return;
        const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));

        let onlinePlayers = server.hasPluginProtocol() ? await server.protocol.getOnlinePlayers() : null;
        if(onlinePlayers === null || onlinePlayers.status !== 200) onlinePlayers = 0;
        else onlinePlayers = onlinePlayers.data.length;

        const serverIp = propertiesObject['server-ip'] ?? server.protocol.ip;
        const serverName = propertiesObject['server-name'] ?? serverIp;

        const motd = propertiesObject['motd']
            .replace(/\\u00A7/gi, '\u00A7')
            .replace('\\n', '\n')
            .split('\n');

        const listCanvas = Canvas.createCanvas(869, 128);
        const ctx = listCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const background = await Canvas.loadImage('./resources/images/backgrounds/menu_dark.png');
        ctx.drawImage(background, 0, 0, listCanvas.width, listCanvas.height);
        const onlineIcon = await Canvas.loadImage('./resources/images/misc/online.png');
        ctx.drawImage(onlineIcon, listCanvas.width - 40, 4, 32, 32);
        const iconBuffer = serverIcon.data ? serverIcon.data : await fs.readFile('./resources/images/misc/unknown_server.png');
        const iconImage = await Canvas.loadImage(iconBuffer);
        ctx.drawImage(iconImage, 0, 0, 128, 128);

        ctx.font = '28px Minecraft';
        ctx.fillStyle = '#fff';

        //Draw server name
        this.drawShadowText(ctx, serverName, 128, 32);

        //Draw motd
        ctx.textAlign = 'center';
        if(motd.length === 1) {
            //Put first line on second line if only one line
            motd[1] = motd[0];
            motd[0] = '';
        }
        ctx.save();
        utils.drawMinecraftText(ctx, motd[0], listCanvas.width / 2 - 32, 70);
        utils.drawMinecraftText(ctx, motd[1], listCanvas.width / 2 - 32, 102);
        ctx.restore();

        //Draw online players
        ctx.textAlign = 'right';
        const playerText = `${onlinePlayers}/${propertiesObject['max-players']}`;
        const textMeasure = ctx.measureText(playerText);
        this.drawShadowText(ctx, playerText, listCanvas.width - 8 - textMeasure.width, 32);

        const iconAttachment = new Discord.AttachmentBuilder(iconBuffer, {
            name: 'server-icon.png',
            description: 'Server Icon',
        });
        const serverListAttachment = new Discord.AttachmentBuilder(listCanvas.toBuffer('image/png'), {
            name: 'server-list.png',
            description: 'Server List',
        });

        /** @type {Discord.InteractionReplyOptions} */
        const startingMessage = {
            embeds: [keys.commands.serverinfo.success.general],
            files: [iconAttachment, serverListAttachment],
        };

        /** @type {PaginationPages} */
        const pages = {
            serverinfo_general: {
                button: getComponent(keys.commands.serverinfo.success.general_button),
                page: getReplyOptions(startingMessage, {
                    server_name: propertiesObject['server-name'] ?? keys.commands.serverinfo.warnings.unknown_server_name,
                    motd: motd.join('\n'),
                    max_players: propertiesObject['max-players'],
                    online_players: onlinePlayers,
                    ip: serverIp,
                    version: datObject.Data.Version.Name,
                }),
                startPage: true,
            },
            serverinfo_world: {
                button: getComponent(keys.commands.serverinfo.success.world_button),
                page: getReplyOptions(keys.commands.serverinfo.success.world, {}),
            },
            serverinfo_admin: {
                button: getComponent(keys.commands.serverinfo.success.admin_button),
                page: getReplyOptions(keys.commands.serverinfo.success.admin, {}),
            },
        };

        const pagination = new Pagination(client, interaction, pages);
        return pagination.start();
    }

    drawShadowText(ctx, text, x, y) {
        ctx.fillStyle = '#000';
        ctx.fillText(text, x + 4, y + 4);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, x, y);
    }
}

module.exports = ServerInfo;
