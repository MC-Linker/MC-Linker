import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import { FilePath } from '../../structures/Protocol.js';
import * as utils from '../../utilities/utils.js';
import { codeBlockFromCommandResponse, formatDuration, getMinecraftAvatarURL } from '../../utilities/utils.js';
import {
    addPh,
    addTranslatedResponses,
    createActionRows,
    getComponent,
    getReplyOptions,
    ph,
} from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import DefaultButton from '../../structures/helpers/DefaultButton.js';
import minecraft_data from 'minecraft-data';
import Discord, { ComponentType, time } from 'discord.js';

const mcData = minecraft_data('1.20.1');

export default class UserInfo extends Command {

    constructor() {
        super({
            name: 'userinfo',
            category: 'other',
            requiresUserIndex: 0,
            requiresConnectedServer: true,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        /** @type {UserResponse} */
        const user = args[0];

        const batch = await server.protocol.startBatch();
        if(!await utils.handleProtocolResponse(batch, server.protocol, interaction)) return;

        let onlinePlayers = [];
        if(server.protocol.isPluginProtocol()) {
            const onlinePlayersResponse = await server.protocol.getOnlinePlayers();
            if(onlinePlayersResponse?.status === 200) onlinePlayers = onlinePlayersResponse.data.map(p => p.toLowerCase());
        }

        const scoreboardDatResponse = await server.protocol.get(...FilePath.Scoreboards(server.worldPath, server.id));
        const levelDatResponse = await server.protocol.get(...FilePath.LevelDat(server.worldPath, server.id));

        let stats = await server.protocol.get(FilePath.Stats(server.worldPath, user.uuid), `./download-cache/playerdata/${user.uuid}.dat`);
        let operators = await server.protocol.get(...FilePath.Operators(server.path, server.id));
        let whitelistedUsers = await server.protocol.get(...FilePath.Whitelist(server.path, server.id));
        let bannedUsers = await server.protocol.get(...FilePath.BannedPlayers(server.path, server.id));

        const playerDat = await utils.getLivePlayerNbt(server, user, null);
        await server.protocol.endBatch();

        operators = operators?.status === 200 ? JSON.parse(operators.data.toString()) : [];
        whitelistedUsers = whitelistedUsers?.status === 200 ? JSON.parse(whitelistedUsers.data.toString()) : [];
        bannedUsers = bannedUsers?.status === 200 ? JSON.parse(bannedUsers.data.toString()) : [];
        stats = stats?.status === 200 ? JSON.parse(stats.data.toString()) : [];

        let scoreboardDat = null;
        let levelDat = null;
        if(scoreboardDatResponse?.status === 200) scoreboardDat = await utils.nbtBufferToObject(scoreboardDatResponse.data, interaction);
        if(scoreboardDat === undefined) return; // If nbtBufferToObject returns undefined, it means that the file is corrupted
        if(levelDatResponse?.status === 200) levelDat = await utils.nbtBufferToObject(levelDatResponse.data, interaction);
        if(levelDatResponse === undefined) return; // If nbtBufferToObject returns undefined, it means that the file is corrupted

        const matchingOp = operators.find(o => o.uuid === user.uuid);
        const matchingWhitelist = whitelistedUsers.find(w => w.uuid === user.uuid);
        const matchingBan = bannedUsers.find(b => b.uuid === user.uuid);

        const placeholders = {
            name: user.username,
            uuid: user.uuid,
            icon_url: await getMinecraftAvatarURL(user.username),
            status: onlinePlayers.includes(user.username.toLowerCase()) ? keys.commands.userinfo.online : keys.commands.userinfo.offline,
            status_emoji: onlinePlayers.includes(user.username.toLowerCase()) ? ':green_circle:' : ':red_circle:',
            operator: matchingOp ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            operator_level: matchingOp?.level ?? 0,
            whitelisted: matchingWhitelist ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
            banned: matchingBan ? keys.commands.userinfo.yes : keys.commands.userinfo.no,
        };
        const generalMessage = getReplyOptions(keys.commands.userinfo.success.general, placeholders, ph.colors());
        const adminMessage = getReplyOptions(keys.commands.userinfo.success.admin, placeholders, ph.colors());
        const survivalMessage = getReplyOptions(keys.commands.userinfo.success.survival, placeholders, ph.colors());

        const newAdminFields = [];
        const newSurvivalFields = [];
        if(playerDat) {
            placeholders.xp = playerDat.XpTotal;
            placeholders.xp_level = playerDat.XpLevel;
            placeholders.food = playerDat.foodLevel;
            placeholders.saturation = playerDat.foodSaturationLevel;
            placeholders.health = (playerDat.Health / 2).toFixed(1);
            placeholders.score = playerDat.Score;
            placeholders.gamemode = keys.commands.userinfo.gamemode[playerDat.playerGameType] ?? keys.commands.serverinfo.unknown;
            placeholders.dimension = keys.commands.userinfo.dimensions[playerDat.Dimension.replace('minecraft:', '')] ?? keys.commands.serverinfo.unknown;
            playerDat.Pos = playerDat.Pos.map(pos => Math.round(pos)); // Round the position to the nearest integer
            placeholders.position = `${playerDat.Pos[0]}, ${playerDat.Pos[1]}, ${playerDat.Pos[2]}`;
            placeholders.death_location = `${playerDat.LastDeathLocation?.pos?.[0] ?? '?'}, ${playerDat.LastDeathLocation?.pos?.[1] ?? '?'}, ${playerDat.LastDeathLocation?.pos?.[2] ?? '?'}`;
            placeholders.death_dimension = keys.commands.userinfo.dimensions[playerDat.LastDeathLocation?.dimension?.replace('minecraft:', '')] ?? keys.commands.serverinfo.unknown;
            placeholders.spawn_location = playerDat.SpawnX && playerDat.SpawnY && playerDat.SpawnZ ? `${playerDat.SpawnX}, ${playerDat.SpawnY}, ${playerDat.SpawnZ}` : null; // set it from level.dat
            placeholders.spawn_dimension = playerDat.SpawnDimension ? keys.commands.userinfo.dimensions[playerDat.SpawnDimension.replace('minecraft:', '')] : null; // set it from level.dat
            // these values will be an integer if it's coming from the data command and a bigint if it's coming from the playerdata file
            if(playerDat.bukkit?.firstPlayed && typeof playerDat.bukkit.firstPlayed !== 'bigint') playerDat.bukkit.firstPlayed = BigInt(playerDat.bukkit.firstPlayed);
            if(playerDat.bukkit?.firstPlayed && typeof playerDat.bukkit.lastPlayed !== 'bigint') playerDat.bukkit.lastPlayed = BigInt(playerDat.bukkit.lastPlayed);
            placeholders.first_join = playerDat.bukkit?.firstPlayed ? time(Number(playerDat.bukkit.firstPlayed / 1000n)) : keys.commands.serverinfo.unknown;
            placeholders.last_join = playerDat.bukkit?.lastPlayed ? time(Number(playerDat.bukkit.lastPlayed / 1000n)) : keys.commands.serverinfo.unknown;
            if(playerDat.ActiveEffects?.length > 0) {
                placeholders.effects = playerDat.ActiveEffects.map(effect => mcData.effectsArray.find(e => e.id === effect.Id)?.displayName).filter(e => e).join('\n');
            }

            newSurvivalFields.push(...(addPh(keys.commands.userinfo.success.survival.embeds[0].fields.slice(0, 7), placeholders)));
            if(placeholders.effects) newSurvivalFields.push(addPh(keys.commands.userinfo.success.survival.embeds[0].fields[8], placeholders));
            newAdminFields.push(...(addPh(
                keys.commands.userinfo.success.admin.embeds[0].fields, placeholders,
            )));
        }
        if(!placeholders.spawn_location || !placeholders.spawn_dimension) {
            // If the spawn location is not in the playerdata file, try to get it from the level.dat file
            placeholders.spawn_location = `${levelDat?.Data?.SpawnX ?? '?'}, ${levelDat?.Data?.SpawnY ?? '?'}, ${levelDat?.Data?.SpawnZ ?? '?'}`;
            placeholders.spawn_dimension = keys.commands.userinfo.dimensions.overworld;

            //replace the spawn location and dimension field
            if(newAdminFields.length !== 0) newAdminFields.splice(1, 1, addPh(
                keys.commands.userinfo.success.admin.embeds[0].fields[1], placeholders,
            ));
        }
        if(scoreboardDat) {
            const teams = scoreboardDat.data.Teams.filter(team => team.Players.includes(user.username));
            if(teams.length > 0) placeholders.teams = teams.map(team => JSON.parse(team.DisplayName).text).join('\n');
            if(placeholders.teams) newSurvivalFields.push(addPh(
                keys.commands.userinfo.success.survival.embeds[0].fields[9], placeholders,
            ));
        }
        if(stats) {
            const playTimeTicks = stats?.stats?.['minecraft:custom']?.['minecraft:play_time'];
            const playTimeMinutes = stats.stats?.['minecraft:custom']?.['minecraft:play_one_minute'];
            if(playTimeTicks || playTimeMinutes) {
                let playTimeMs;
                if(playTimeTicks) playTimeMs = Math.round(playTimeTicks / 20 * 1000);
                else if(playTimeMinutes) playTimeMs = playTimeMinutes * 60 * 1000;
                placeholders.play_time = formatDuration(playTimeMs);

                newSurvivalFields.push(addPh(
                    keys.commands.userinfo.success.survival.embeds[0].fields[7], placeholders,
                ));
            }
        }

        //Push the fields even if they're unknown so that admin buttons can be shown
        if(newAdminFields.length === 0) newAdminFields.push(...(addPh(keys.commands.userinfo.success.admin.embeds[0].fields, placeholders, {
            position: '?, ?, ?',
            dimension: keys.commands.serverinfo.unknown,
            death_location: '?, ?, ?',
            death_dimension: keys.commands.serverinfo.unknown,
        })));

        survivalMessage.embeds[0].setFields(newSurvivalFields);
        adminMessage.embeds[0].setFields(newAdminFields);

        const adminButtons = [
            matchingBan ? getComponent(keys.commands.userinfo.success.buttons.unban) : getComponent(keys.commands.userinfo.success.buttons.ban),
            matchingOp ? getComponent(keys.commands.userinfo.success.buttons.deop) : getComponent(keys.commands.userinfo.success.buttons.op),
            matchingWhitelist ? getComponent(keys.commands.userinfo.success.buttons.unwhitelist) : getComponent(keys.commands.userinfo.success.buttons.whitelist),
        ];
        if(onlinePlayers.includes(user.username.toLowerCase())) adminButtons.unshift(getComponent(keys.commands.userinfo.success.buttons.kick));

        // FTP does not support commands
        if(!server.protocol.isFtpProtocol()) adminMessage.components = createActionRows(adminButtons);

        /** @type {PaginationPages} */
        const pages = {
            userinfo_general: {
                button: getComponent(keys.commands.userinfo.success.buttons.general),
                page: generalMessage,
                startPage: true,
            },
            userinfo_survival: {
                button: getComponent(keys.commands.userinfo.success.buttons.survival),
                page: survivalMessage,
            },
            userinfo_admin: {
                button: getComponent(keys.commands.userinfo.success.buttons.admin),
                page: adminMessage,
            },
        };

        if(newSurvivalFields.length === 0) delete pages.userinfo_survival;
        // If the user is not an admin, delete the admin page
        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) delete pages.userinfo_admin;

        const pagination = new Pagination(client, interaction, pages);
        const message = await pagination.start();
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: pagination.options.timeout ?? 120_000,
        });

        ['ban', 'unban', 'kick', 'op', 'deop', 'whitelist', 'unwhitelist']
            .map(k => `userinfo_${k}`)
            .forEach(command => {
                // Create new button triggered by the collector
                new DefaultButton({
                    id: command,
                    author: interaction.user,
                    permissions: [Discord.PermissionFlagsBits.Administrator],
                    ephemeral: true,
                    collector,
                }, this.handleAdminButton.bind(null, user));
            });
    }

    /**
     * Handles admin buttons for userinfo (kick, ban, unban, whitelist, unwhitelist)
     * @param {UserResponse} user - The user to perform the action on
     * @param {Discord.ButtonInteraction} interaction - The interaction
     * @param {MCLinker} client - The MCLinker client.
     * @param {?ServerConnection} server - The connection of the server the button was executed in.
     */
    async handleAdminButton(user, interaction, client, server) {
        if(!server) return;
        interaction = addTranslatedResponses(interaction);

        let command;
        if(interaction.customId === 'userinfo_kick') command = `kick ${user.username}`;
        else if(interaction.customId === 'userinfo_ban') command = `ban ${user.username}`;
        else if(interaction.customId === 'userinfo_unban') command = `pardon ${user.username}`;
        else if(interaction.customId === 'userinfo_whitelist') command = `whitelist add ${user.username}`;
        else if(interaction.customId === 'userinfo_unwhitelist') command = `whitelist remove ${user.username}`;
        else if(interaction.customId === 'userinfo_op') command = `op ${user.username}`;
        else if(interaction.customId === 'userinfo_deop') command = `deop ${user.username}`;
        else return;

        const commandResponse = await server.protocol.execute(command);
        if(!await utils.handleProtocolResponse(commandResponse, server.protocol, interaction)) return;

        let response = commandResponse.data?.message ? commandResponse.data.message : keys.api.plugin.warnings.no_response_message;
        response = codeBlockFromCommandResponse(response);
        await interaction.replyTl(keys.commands.userinfo.success.admin_button, { response, command });

        if(interaction.customId === 'userinfo_kick') return;

        //Toggle buttons (ban <-> unban, whitelist <-> unwhitelist, op <-> deop)
        const buttons = interaction.message.components[0].components;
        const button = buttons.find(button => button.customId === interaction.customId);
        const buttonIndex = buttons.indexOf(button);

        const toggleMap = {
            'ban': 'unban',
            'whitelist': 'unwhitelist',
            'op': 'deop',
        };

        let key = toggleMap[interaction.customId.replace('userinfo_', '')];
        if(!key) key = Object.keys(toggleMap).find(k => toggleMap[k] === interaction.customId.replace('userinfo_', ''));

        buttons[buttonIndex] = getComponent(keys.commands.userinfo.success.buttons[key]);
        await interaction.message.edit({ components: interaction.message.components });
    }
}
