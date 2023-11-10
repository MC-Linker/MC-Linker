import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import { FilePath } from '../../structures/Protocol.js';
import Discord from 'discord.js';
import * as utils from '../../utilities/utils.js';
import { addPh, getComponent, getEmbed } from '../../utilities/messages.js';
import gamerules from '../../resources/data/gamerules.json' assert { type: 'json' };
import { unraw } from 'unraw';
import Pagination from '../../structures/helpers/Pagination.js';
import fs from 'fs-extra';
import Canvas from 'skia-canvas';

export default class ServerInfo extends Command {

    constructor() {
        super({
            name: 'serverinfo',
            category: 'other',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const batch = await server.protocol.startBatch();
        if(!await utils.handleProtocolResponse(batch, server.protocol, interaction)) return;

        const serverProperties = await server.protocol.get(...FilePath.ServerProperties(server.path, server.id));
        const levelDat = await server.protocol.get(...FilePath.LevelDat(server.worldPath, server.id));
        if(!await utils.handleProtocolResponses([serverProperties, levelDat], server.protocol, interaction, {
            404: keys.api.command.errors.could_not_download,
        }, { category: 'server-info' })) return await server.protocol.endBatch();

        const datObject = await utils.nbtBufferToObject(levelDat.data, interaction);
        if(!datObject) return await server.protocol.endBatch();
        const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));

        const serverIcon = await server.protocol.get(...FilePath.ServerIcon(server.path, server.id));

        let operators = [];
        let whitelistedUsers = [];
        let bannedUsers = [];
        let bannedIPs = [];
        let plugins = [];
        let mods = [];
        let datapacks = [];
        const isAdmin = interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator);
        if(isAdmin) {
            operators = await server.protocol.get(...FilePath.Operators(server.path, server.id));
            whitelistedUsers = await server.protocol.get(...FilePath.Whitelist(server.path, server.id));
            bannedUsers = await server.protocol.get(...FilePath.BannedPlayers(server.path, server.id));
            bannedIPs = await server.protocol.get(...FilePath.BannedIPs(server.path, server.id));
            plugins = await server.protocol.list(FilePath.Plugins(server.path));
            mods = await server.protocol.list(FilePath.Mods(server.path));

            operators = operators?.status === 200 ? JSON.parse(operators.data.toString()) : null;
            whitelistedUsers = whitelistedUsers?.status === 200 ? JSON.parse(whitelistedUsers.data.toString()) : null;
            bannedUsers = bannedUsers?.status === 200 ? JSON.parse(bannedUsers.data.toString()) : null;
            bannedIPs = bannedIPs?.status === 200 ? JSON.parse(bannedIPs.data.toString()) : null;
            plugins = plugins?.status === 200 ? plugins.data.filter(file => !file.isDirectory && file.name.endsWith('.jar')).map(plugin => plugin.name.replace('.jar', '')) : [];
            mods = mods?.status === 200 ? mods.data.filter(file => !file.isDirectory).map(mod => mod.name.replace('.jar', '')) : [];

            datapacks = datObject.Data.DataPacks.Enabled?.map(pack => pack.replace('file/', '').replace('.zip', '').cap()) ?? [];

            //Reduce plugins, mods and datapacks array so that it doesn't exceed max embed field value length
            for(const array of [plugins, mods, datapacks]) {
                while(array.join('\n').length > utils.MaxEmbedFieldValueLength) {
                    array.pop();
                }
            }
        }
        await server.protocol.endBatch();

        let onlinePlayers = server.protocol.isPluginProtocol() ? await server.protocol.getOnlinePlayers() : null;
        if(onlinePlayers === null || onlinePlayers.status !== 200) onlinePlayers = 0;
        else onlinePlayers = onlinePlayers.data.length;

        const serverName = propertiesObject['server-name'] ?? server.getDisplayIp();
        const serverIp = server.getDisplayIp();

        let motd;
        try {
            motd = unraw(propertiesObject['motd']).split('\n');
        }
        catch(e) {
            motd = propertiesObject['motd'].split('\n');
        }
        const listCanvas = new Canvas.Canvas(869, 128);
        const ctx = listCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const background = await Canvas.loadImage('./resources/images/backgrounds/menu_dark.png');
        ctx.drawImage(background, 0, 0, listCanvas.width, listCanvas.height);
        const onlineIcon = await Canvas.loadImage('./resources/images/misc/online.png');
        ctx.drawImage(onlineIcon, listCanvas.width - 40, 4, 32, 32);
        const iconBuffer = Buffer.isBuffer(serverIcon.data) ? serverIcon.data : await fs.readFile('./resources/images/misc/unknown_server.png');
        const iconImage = await Canvas.loadImage(iconBuffer);
        ctx.drawImage(iconImage, 0, 0, 128, 128);

        ctx.font = '28px Minecraft';
        ctx.fillStyle = '#fff';

        //Draw server name
        ctx.fillText(serverName, 134, 32);

        ctx.fillStyle = '#AAA';

        //Draw motd
        ctx.save();
        utils.drawMinecraftText(ctx, motd[0], 134, 70);
        if(motd[1]) utils.drawMinecraftText(ctx, motd[1], 134, 102);
        ctx.restore();

        //Draw online players
        ctx.textAlign = 'right';
        const playerText = `${onlinePlayers}/${propertiesObject['max-players']}`;
        const textMeasure = ctx.measureText(playerText);
        ctx.fillText(playerText, listCanvas.width - 4 - textMeasure.width, 32);

        const iconAttachment = new Discord.AttachmentBuilder(iconBuffer, {
            name: 'server-icon.png',
            description: 'Server Icon',
        });
        const serverListAttachment = new Discord.AttachmentBuilder(await listCanvas.toBuffer('png'), {
            name: 'server-list.png',
            description: 'Server List',
        });

        const difficulty = typeof propertiesObject['difficulty'] === 'number' ?
            keys.commands.serverinfo.difficulty[propertiesObject['difficulty']] :
            propertiesObject['difficulty'].cap();

        const filteredGamerules = Object.entries(datObject.Data.GameRules)
            .filter(([key, value]) => {
                const rule = gamerules.find(rule => rule.name === key);
                if(!rule) return true;
                if(rule.type === 'bool') return rule.default !== (value === 'true');
                if(rule.type === 'int') return rule.default !== Number(value);
                return rule.default !== value;
            })
            .map(([key, value]) => `${key}: ${value}`);

        const worldEmbed = getEmbed(keys.commands.serverinfo.success.world, {
            spawn_x: datObject.Data.SpawnX,
            spawn_y: datObject.Data.SpawnY,
            spawn_z: datObject.Data.SpawnZ,
            spawn_world: datObject.Data.LevelName,
            allow_end: propertiesObject['allow-end'] ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
            allow_nether: propertiesObject['allow-nether'] ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
            difficulty,
            gamerules: filteredGamerules.join('\n'),
        });
        if(propertiesObject['hardcore']) {
            worldEmbed.data.fields[2] = addPh(keys.commands.serverinfo.success.hardcore_enabled.embeds[0].fields[0], { difficulty });
        }

        /** @type {Discord.InteractionReplyOptions} */
        const startingMessage = {
            embeds: [getEmbed(keys.commands.serverinfo.success.general, {
                server_name: propertiesObject['server-name'] ?? keys.commands.serverinfo.unknown,
                motd: motd.join('\n'),
                max_players: propertiesObject['max-players'],
                online_players: onlinePlayers,
                ip: serverIp,
                version: datObject.Data.Version.Name,
            })],
            files: [iconAttachment, serverListAttachment],
        };
        /** @type {PaginationPages} */
        const pages = {
            serverinfo_general: {
                button: getComponent(keys.commands.serverinfo.success.general_button),
                page: startingMessage,
                startPage: true,
            },
            serverinfo_world: {
                button: getComponent(keys.commands.serverinfo.success.world_button),
                page: { embeds: [worldEmbed], files: [] },
            },
        };

        if(isAdmin) {
            const adminEmbed = getEmbed(keys.commands.serverinfo.success.admin, {
                enable_whitelist: propertiesObject['white-list'] ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
                seed: datObject.Data.WorldGenSettings.seed,
            });
            const newFields = [];
            if(plugins.length > 0) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[0], { plugins: plugins.join('\n') }));
            if(datapacks.length > 0) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[1], { datapacks: datapacks.join('\n') }));
            if(mods.length > 0) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[2], { mods: mods.join('\n') }));
            if(whitelistedUsers) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[3], { whitelisted_users: whitelistedUsers.length }));
            if(bannedUsers) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[4], { banned_users: bannedUsers.length }));
            if(bannedIPs) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[5], { banned_ips: bannedIPs.length }));
            if(operators) newFields.push(addPh(keys.commands.serverinfo.success.admin.embeds[0].fields[6], { operators: operators.length }));
            newFields.push(adminEmbed.data.fields[7], adminEmbed.data.fields[8]); //Copy seed and whitelist fields
            adminEmbed.setFields(...newFields);

            pages['serverinfo_admin'] = {
                button: getComponent(keys.commands.serverinfo.success.admin_button),
                page: { embeds: [adminEmbed], files: [] },
                buttonOptions: {
                    permissions: new Discord.PermissionsBitField(Discord.PermissionFlagsBits.Administrator),
                },
            };
        }

        const pagination = new Pagination(client, interaction, pages);
        return pagination.start();
    }
}
