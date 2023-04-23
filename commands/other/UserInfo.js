import Command from '../../structures/Command.js';
import keys from '../../api/keys.js';
import { FilePath } from '../../structures/Protocol.js';
import * as utils from '../../api/utils.js';
import { formatDuration, minecraftAvatarURL } from '../../api/utils.js';
import { addPh, getComponent, getReplyOptions, ph } from '../../api/messages.js';
import minecraft_data from 'minecraft-data';
import Pagination from '../../structures/helpers/Pagination.js';
import { time } from 'discord.js';

const mcData = minecraft_data('1.19.4');

export default class UserInfo extends Command {

    constructor() {
        super({
            name: 'userinfo',
            category: 'other',
            requiresUserIndex: 0,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];

        const batch = await server.protocol.startBatch();
        if(!await utils.handleProtocolResponse(batch, server.protocol, interaction)) return;

        const scoreboardDat = await server.protocol.get(...FilePath.Scoreboards(server.worldPath, server.id));
        //TODO get live data with commands if plugin connection
        const playerDat = await server.protocol.get(FilePath.PlayerData(server.worldPath, user.uuid), `./userdata/playerdata/${user.uuid}.dat`);

        let stats = await server.protocol.get(FilePath.Stats(server.worldPath, user.uuid), `./userdata/playerdata/${user.uuid}.dat`);
        let operators = await server.protocol.get(...FilePath.Operators(server.path, server.id));
        let whitelistedUsers = await server.protocol.get(...FilePath.Whitelist(server.path, server.id));
        let bannedUsers = await server.protocol.get(...FilePath.BannedPlayers(server.path, server.id));

        let onlinePlayers = [];
        if(!server.hasFtpProtocol()) {
            const onlinePlayersResponse = await server.protocol.getOnlinePlayers();
            if(onlinePlayersResponse?.status === 200) onlinePlayers = onlinePlayersResponse.data;
        }
        await server.protocol.endBatch();

        operators = operators?.status === 200 ? JSON.parse(operators.data.toString()) : [];
        whitelistedUsers = whitelistedUsers?.status === 200 ? JSON.parse(whitelistedUsers.data.toString()) : [];
        bannedUsers = bannedUsers?.status === 200 ? JSON.parse(bannedUsers.data.toString()) : [];
        stats = stats?.status === 200 ? JSON.parse(stats.data.toString()) : [];

        let scoreboardDatObject = null;
        let playerDatObject = null;
        if(scoreboardDat?.status === 200) scoreboardDatObject = await utils.nbtBufferToObject(scoreboardDat.data, interaction);
        if(scoreboardDatObject === undefined) return; // If nbtBufferToObject returns undefined, it means that the file is corrupted
        if(playerDat?.status === 200) playerDatObject = await utils.nbtBufferToObject(playerDat.data, interaction);
        if(playerDatObject === undefined) return;

        const matchingOp = operators.find(o => o.uuid === user.uuid);
        const matchingWhitelist = whitelistedUsers.find(w => w.uuid === user.uuid);
        const matchingBan = bannedUsers.find(b => b.uuid === user.uuid);

        const placeholders = {
            name: user.username,
            uuid: user.uuid,
            icon_url: minecraftAvatarURL(user.username),
            status: onlinePlayers.includes(user.username) ? keys.commands.userinfo.online : keys.commands.userinfo.offline,
            operator: matchingOp ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            operator_level: matchingOp?.level ?? 0,
            whitelisted: matchingWhitelist ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            banned: matchingBan ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
        };
        const generalMessage = getReplyOptions(keys.commands.userinfo.success.general, placeholders, ph.colors());
        const adminMessage = getReplyOptions(keys.commands.userinfo.success.admin, placeholders, ph.colors());

        const newGeneralFields = generalMessage.embeds[0].data.fields.slice(0, 4);
        const newAdminFields = [];
        if(playerDatObject) {
            placeholders.xp = playerDatObject.XpTotal;
            placeholders.xp_level = playerDatObject.XpLevel;
            placeholders.food = playerDatObject.foodLevel;
            placeholders.saturation = playerDatObject.foodSaturationLevel;
            placeholders.health = playerDatObject.Health / 2;
            placeholders.score = playerDatObject.Score;
            placeholders.gamemode = keys.commands.userinfo.gamemode[playerDatObject.playerGameType] ?? keys.commands.serverinfo.unknown;
            placeholders.dimension = keys.commands.userinfo.dimensions[playerDatObject.Dimension.replace('minecraft:', '')] ?? keys.commands.serverinfo.unknown;
            placeholders.position = `${playerDatObject.Pos[0]}, ${playerDatObject.Pos[1]}, ${playerDatObject.Pos[2]}`;
            placeholders.death_location = `${playerDatObject.LastDeathLocation?.pos?.[0] ?? '?'}, ${playerDatObject.LastDeathLocation?.pos?.[1] ?? '?'}, ${playerDatObject.LastDeathLocation?.pos?.[2] ?? '?'}`;
            placeholders.death_dimension = keys.commands.userinfo.dimensions[playerDatObject.LastDeathLocation?.dimension?.replace('minecraft:', '')] ?? keys.commands.serverinfo.unknown;
            placeholders.spawn_location = `${playerDatObject.SpawnX ?? '?'}, ${playerDatObject.SpawnY ?? '?'}, ${playerDatObject.SpawnZ ?? '?'}`;
            placeholders.spawn_dimension = keys.commands.userinfo.dimensions[playerDatObject.SpawnDimension?.replace('minecraft:', '')] ?? keys.commands.serverinfo.unknown;
            placeholders.first_join = playerDatObject.bukkit?.firstPlayed ? time(Number(playerDatObject.bukkit.firstPlayed / 1000n)) : keys.commands.serverinfo.unknown;
            placeholders.last_join = playerDatObject.bukkit?.lastPlayed ? time(Number(playerDatObject.bukkit.lastPlayed / 1000n)) : keys.commands.serverinfo.unknown;
            if(playerDatObject.ActiveEffects?.length > 0) {
                placeholders.effects = playerDatObject.ActiveEffects.map(effect => mcData.effectsArray.find(e => e.id === effect.Id)?.displayName).filter(e => e).join('\n');
            }
            else placeholders.effects = keys.commands.userinfo.none;

            const fieldsToPush = [
                ...(keys.commands.userinfo.success.general.embeds[0].fields.slice(4, 11)),
                keys.commands.userinfo.success.general.embeds[0].fields[12],
            ];
            newGeneralFields.push(...(addPh(fieldsToPush, placeholders)));
            newAdminFields.push(...(addPh(
                keys.commands.userinfo.success.admin.embeds[0].fields, placeholders,
            )));
        }
        if(stats) {
            const playTimeTicks = stats?.stats?.['minecraft:custom']?.['minecraft:play_time'];
            const playTimeMinutes = stats.stats?.['minecraft:custom']?.['minecraft:play_one_minute'];
            if(playTimeTicks || playTimeMinutes) {
                let playTimeMs;
                if(playTimeTicks) playTimeMs = Math.round(playTimeTicks / 20 * 1000);
                else if(playTimeMinutes) playTimeMs = playTimeMinutes * 60 * 1000;
                placeholders.play_time = formatDuration(playTimeMs);

                newGeneralFields.push(addPh(
                    keys.commands.userinfo.success.general.embeds[0].fields[11], placeholders,
                ));
            }
        }
        if(scoreboardDatObject) {
            const teams = scoreboardDatObject.data.Teams.filter(team => team.Players.includes(user.username));
            if(teams.length > 0) placeholders.teams = teams.map(team => team.DisplayName).join('\n');
            else placeholders.teams = keys.commands.userinfo.none;
            newGeneralFields.push(addPh(
                keys.commands.userinfo.success.general.embeds[0].fields[13], placeholders,
            ));
        }
        generalMessage.embeds[0].setFields(...newGeneralFields);
        adminMessage.embeds[0].setFields(...newAdminFields);

        /** @type {PaginationPages} */
        const pages = {
            userinfo_general: {
                button: getComponent(keys.commands.userinfo.success.general_button),
                page: generalMessage,
                startPage: true,
            },
            userinfo_admin: {
                button: getComponent(keys.commands.userinfo.success.admin_button),
                page: adminMessage,
            },
        };
        // If there are no admin fields, delete the admin page
        if(newAdminFields.length === 0) delete pages.userinfo_admin;

        const pagination = new Pagination(client, interaction, pages);
        await pagination.start();
    }
}
