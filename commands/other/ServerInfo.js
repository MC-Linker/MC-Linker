import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import { FilePath, ProtocolError } from '../../structures/protocol/Protocol.js';
import Discord from 'discord.js';
import * as utils from '../../utilities/utils.js';
import { addPh, getComponent, getEmbed, setCachedFooter } from '../../utilities/messages.js';
import gamerules from '../../resources/data/gamerules.json' with { type: 'json' };
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

        const serverProperties = await server.protocol.getWithCache(...FilePath.ServerProperties(server.path, server.id));
        const levelDat = await server.protocol.getWithCache(...FilePath.LevelDat(server.worldPath, server.id));
        if(!await utils.handleProtocolResponses([serverProperties, levelDat], server.protocol, interaction, {
            [ProtocolError.NOT_FOUND]: keys.api.command.errors.could_not_download,
        }, { category: 'server-info' })) return await server.protocol.endBatch();

        let isCached = serverProperties?.cached || levelDat?.cached;

        const datObject = await utils.nbtBufferToObject(levelDat.data, interaction);
        if(!datObject) return;
        const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));

        const serverIcon = await server.protocol.getWithCache(...FilePath.ServerIcon(server.path, server.id));
        if(serverIcon?.cached) isCached = true;

        let operators = [];
        let whitelistedUsers = [];
        let bannedUsers = [];
        let bannedIPs = [];
        let plugins = [];
        let mods = [];
        let datapacks = [];
        const isAdmin = interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator);
        if(isAdmin) {
            operators = await server.protocol.getWithCache(...FilePath.Operators(server.path, server.id));
            whitelistedUsers = await server.protocol.getWithCache(...FilePath.Whitelist(server.path, server.id));
            bannedUsers = await server.protocol.getWithCache(...FilePath.BannedPlayers(server.path, server.id));
            bannedIPs = await server.protocol.getWithCache(...FilePath.BannedIPs(server.path, server.id));
            plugins = await server.protocol.list(FilePath.Plugins(server.path));
            mods = await server.protocol.list(FilePath.Mods(server.path));

            if(operators?.cached || whitelistedUsers?.cached || bannedUsers?.cached || bannedIPs?.cached) isCached = true;

            operators = operators?.status === 'success' ? JSON.parse(operators.data.toString()) : null;
            whitelistedUsers = whitelistedUsers?.status === 'success' ? JSON.parse(whitelistedUsers.data.toString()) : null;
            bannedUsers = bannedUsers?.status === 'success' ? JSON.parse(bannedUsers.data.toString()) : null;
            bannedIPs = bannedIPs?.status === 'success' ? JSON.parse(bannedIPs.data.toString()) : null;
            plugins = plugins?.status === 'success' ? plugins.data.filter(file => !file.isDirectory && file.name.endsWith('.jar')).map(plugin => plugin.name.replace('.jar', '')) : [];
            mods = mods?.status === 'success' ? mods.data.filter(file => !file.isDirectory).map(mod => mod.name.replace('.jar', '')) : [];

            datapacks = datObject.Data.DataPacks?.Enabled?.map(pack => pack.replace('file/', '').replace('.zip', '').toTitleCase(true)) ?? [];

            //Reduce plugins, mods and datapacks array so that it doesn't exceed max embed field value length
            for(const array of [plugins, mods, datapacks]) {
                while(array.join('\n').length > utils.MaxEmbedFieldValueLength) {
                    array.pop();
                }
            }
        }

        let onlinePlayers = await server.protocol.getOnlinePlayers();
        if(onlinePlayers === null || onlinePlayers.status !== 'success') onlinePlayers = 0;
        else onlinePlayers = onlinePlayers.data.length;

        const serverName = propertiesObject['server-name'] || server.displayIp;
        const serverIp = server.displayIp;

        let motd;
        try {
            if(!propertiesObject['motd']) motd = ['', ''];
            else motd = unraw(propertiesObject['motd']).split('\n');
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
        const iconBuffer = Buffer.isBuffer(serverIcon?.data) ? serverIcon.data : await fs.readFile('./resources/images/misc/unknown_server.png');
        const iconImage = await Canvas.loadImage(iconBuffer);
        ctx.drawImage(iconImage, 0, 0, 128, 128);

        ctx.font = '28px Minecraft';
        ctx.fillStyle = '#fcfcfc';

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
            propertiesObject['difficulty'].toTitleCase();

        const gamerulesObject = datObject.Data.GameRules ?? {};
        const filteredGamerules = Object.entries(gamerulesObject)
            .filter(([key, value]) => {
                const rule = gamerules.find(rule => rule.name === key);
                if(!rule) return true;
                if(rule.type === 'bool') return rule.default !== (value === 'true');
                if(rule.type === 'int') return rule.default !== Number(value);
                return rule.default !== value;
            })
            .map(([key, value]) => `${key}: ${value}`);

        const worldEmbed = getEmbed(keys.commands.serverinfo.success.world, {
            spawn_x: datObject.Data.SpawnX ?? datObject.Data.spawn.pos[0],
            spawn_y: datObject.Data.SpawnY ?? datObject.Data.spawn.pos[1],
            spawn_z: datObject.Data.SpawnZ ?? datObject.Data.spawn.pos[2],
            spawn_world: datObject.Data.LevelName,
            allow_end: propertiesObject['allow-end'] ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
            allow_nether: propertiesObject['allow-nether'] ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
            difficulty,
            gamerules: filteredGamerules.join('\n'),
        });
        if(propertiesObject['hardcore']) {
            worldEmbed.data.fields[2] = addPh(keys.commands.serverinfo.success.hardcore_enabled.embeds[0].fields[0], { difficulty });
        }

        const generalEmbed = getEmbed(keys.commands.serverinfo.success.general, {
            server_name: serverName ?? keys.commands.serverinfo.unknown,
            motd: motd.join('\n'),
            max_players: propertiesObject['max-players'],
            online_players: onlinePlayers,
            ip: serverIp,
            version: datObject.Data.Version?.Name ?? `1.${server.version}`,
        });
        if(isCached) setCachedFooter(generalEmbed);

        /** @type {Discord.InteractionReplyOptions} */
        const startingMessage = {
            embeds: [generalEmbed],
            files: [iconAttachment, serverListAttachment],
        };
        if(isCached) setCachedFooter(worldEmbed);

        /** @type {PaginationPages} */
        const pages = {
            serverinfo_general: {
                button: getComponent(keys.commands.serverinfo.success.general_button),
                options: startingMessage,
                startPage: true,
            },
            serverinfo_world: {
                button: getComponent(keys.commands.serverinfo.success.world_button),
                options: { embeds: [worldEmbed], files: [] },
            },
        };

        if(isAdmin) {
            const adminEmbed = getEmbed(keys.commands.serverinfo.success.admin, {
                enable_whitelist: propertiesObject['white-list'] ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
                seed: datObject.Data.WorldGenSettings?.seed ?? keys.commands.serverinfo.unknown,
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
            if(isCached) setCachedFooter(adminEmbed);

            pages['serverinfo_admin'] = {
                button: getComponent(keys.commands.serverinfo.success.admin_button),
                options: { embeds: [adminEmbed], files: [] },
                buttonOptions: {
                    permissions: new Discord.PermissionsBitField(Discord.PermissionFlagsBits.Administrator),
                },
            };
        }

        const pagination = new Pagination(client, interaction, pages);
        return pagination.start();
    }
}
