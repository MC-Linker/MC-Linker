import Command from '../../structures/Command.js';
import keys from '../../api/keys.js';
import { FilePath } from '../../structures/Protocol.js';
import * as utils from '../../api/utils.js';
import { minecraftAvatarURL } from '../../api/utils.js';
import { time } from 'discord.js';
import { addPh, getComponent, getEmbed, ph } from '../../api/messages.js';
import minecraft_data from 'minecraft-data';
import Pagination from '../../structures/helpers/Pagination.js';

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
        const playerDat = await server.protocol.get(FilePath.PlayerData(server.worldPath, user.uuid), `./userdata/playerdata/${user.uuid}.dat`);

        let stats = await server.protocol.get(FilePath.Stats(server.worldPath, user.uuid), `./userdata/playerdata/${user.uuid}.dat`);
        let operators = await server.protocol.get(...FilePath.Operators(server.worldPath, server.id));
        let whitelistedUsers = await server.protocol.get(...FilePath.Whitelist(server.worldPath, server.id));
        let bannedUsers = await server.protocol.get(...FilePath.BannedPlayers(server.worldPath, server.id));

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

        const placeholders = {
            name: user.username,
            uuid: user.uuid,
            icon_url: minecraftAvatarURL(user.username),
            status: onlinePlayers.includes(user.username) ? keys.commands.userinfo.online : keys.commands.userinfo.offline,
            banned: bannedUsers.includes(user.uuid) ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            whitelisted: whitelistedUsers.includes(user.uuid) ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            operator: operators.includes(user.uuid) ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            operator_level: operators[user.uuid] ?? 0,
        };
        const generalEmbed = getEmbed(keys.commands.userinfo.success.general, placeholders, ph.colors());
        const adminEmbed = getEmbed(keys.commands.userinfo.success.admin, placeholders, ph.colors());

        const newGeneralFields = keys.commands.userinfo.success.general.embeds[0].fields.slice(0, 4);
        const newAdminFields = [];
        if(playerDatObject) {
            //TODO bukkit time
            placeholders.xp = playerDatObject.XpTotal;
            placeholders.xp_level = playerDatObject.XpLevel;
            placeholders.food = playerDatObject.foodLevel;
            placeholders.saturation = playerDatObject.foodSaturationLevel;
            placeholders.health = playerDatObject.Health;
            placeholders.score = playerDatObject.Score;
            placeholders.gamemode = keys.commands.userinfo.gamemode[playerDatObject.playerGameType] ?? keys.commands.serverinfo.unknown;
            placeholders.dimension = keys.commands.userinfo.dimensions[playerDatObject.Dimension] ?? keys.commands.serverinfo.unknown;
            placeholders.position = `${playerDatObject.Pos[0]}, ${playerDatObject.Pos[1]}, ${playerDatObject.Pos[2]}`;
            placeholders.death_location = `${playerDatObject.LastDeathLocation.pos[0]}, ${playerDatObject.LastDeathLocation.pos[1]}, ${playerDatObject.LastDeathLocation.pos[2]}`;
            placeholders.death_dimension = keys.commands.userinfo.dimensions[playerDatObject.LastDeathLocation.dimension] ?? keys.commands.serverinfo.unknown;
            placeholders.spawn_location = `${playerDatObject.SpawnX ?? '?'}, ${playerDatObject.SpawnY ?? '?'}, ${playerDatObject.SpawnZ ?? '?'}`;
            placeholders.spawn_dimension = keys.commands.userinfo.dimensions[playerDatObject.SpawnDimension] ?? keys.commands.serverinfo.unknown;
            if(playerDatObject.ActiveEffects?.length > 0) {
                placeholders.effects = playerDatObject.ActiveEffects.map(effect => mcData.effectsArray.find(e => e.id === effect.Id)?.displayName).filter(e => e).join('\n');
            }
            else placeholders.effects = keys.commands.userinfo.none;

            const fieldsToPush = [
                keys.commands.userinfo.success.general.embeds[0].fields.slice(4, 9),
                keys.commands.userinfo.success.general.embeds[0].fields.slice(10, 13),
            ];
            newGeneralFields.push(...(addPh(fieldsToPush, placeholders)));
            newAdminFields.push(...(addPh(
                keys.commands.userinfo.success.admin.embeds[0].fields, placeholders,
            )));
        }
        if(stats) {
            const playTimeTicks = stats.stats['minecraft:custom']['minecraft:play_time'];
            const playTimeMinutes = stats.stats['minecraft:custom']['minecraft:play_one_minute'];
            let playTimeSeconds;
            if(playTimeTicks) playTimeSeconds = playTimeTicks / 20;
            else if(playTimeMinutes) playTimeSeconds = playTimeMinutes * 60;
            placeholders.play_time = time(playTimeSeconds);

            newGeneralFields.push(...(addPh(
                keys.commands.userinfo.success.general.embeds[0].fields[9], placeholders,
            )));
        }
        if(scoreboardDat) {
            placeholders.teams = scoreboardDatObject.Teams.filter(team => team.Players.includes(user.username)).map(team => team.DisplayName).join(', ');
            newGeneralFields.push(...(addPh(
                keys.commands.userinfo.success.general.embeds[0].fields[10], placeholders,
            )));
        }
        generalEmbed.setFields(...newGeneralFields);
        adminEmbed.setFields(...newAdminFields);

        /** @type {PaginationPages} */
        const pages = {
            general: {
                button: getComponent(keys.commands.userinfo.success.general_button),
                page: { embeds: [generalEmbed] },
                startPage: true,
            },
            admin: {
                button: getComponent(keys.commands.userinfo.success.admin_button),
                page: { embeds: [adminEmbed] },
            },
        };

        const pagination = new Pagination(client, nteraction, pages);
        await pagination.start();
    }
}
