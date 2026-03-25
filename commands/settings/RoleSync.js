import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { fetchMembersIfCacheDiffers, MaxAutoCompleteChoices } from '../../utilities/utils.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import { ButtonStyle } from 'discord.js';
import logger from '../../utilities/logger.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';

export default class RoleSync extends AutocompleteCommand {

    constructor() {
        super({
            name: 'rolesync',
            category: 'settings',
            ephemeral: true,
        });
    }

    async autocomplete(interaction, client) {
        if(interaction.options.getSubcommand() !== 'add') return;

        const server = client.serverConnections.cache.get(interaction.guildId);
        if(!server) return;

        const response = await server.protocol.getTeamsAndGroups();
        if(response?.status !== 'success') return;

        const commandResponse = [];
        for(const group of response.data.groups) {
            if(!group.includes(interaction.options.getFocused())) continue;

            // Only push if not already synced
            if(server.syncedRoles?.some(r => r.name === group && r.isGroup === true)) continue;

            commandResponse.push({
                name: `${group} (Group)`,
                value: `${group} group`,
            });
        }
        for(const team of response.data.teams) {
            if(!team.includes(interaction.options.getFocused())) continue;

            // Only push if not already synced
            if(server.syncedRoles?.some(r => r.name === team && r.isGroup === false)) continue;

            commandResponse.push({
                name: `${team} (Team)`,
                value: `${team} team`,
            });
        }

        if(commandResponse.length > MaxAutoCompleteChoices) commandResponse.length = 25;
        await interaction.respond(commandResponse);
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        if(subcommand === 'add') {
            /** @type {import('discord.js').Role} */
            const role = args[1];
            const name = args[2].split(' ')[0];
            const isGroup = args[2].split(' ')[1] === 'group'; //If nothing is specified, default to team
            const direction = args[3] ?? 'both';

            // Only check role.editable if we need to manage the Discord role (both or to_discord)
            if(direction !== 'to_minecraft' && !role.editable)
                return interaction.editReplyTl(keys.commands.rolesync.errors.not_editable, { role });

            if(server.syncedRoles?.some(r => r.id === role.id))
                return interaction.editReplyTl(keys.commands.rolesync.errors.role_already_synced);
            else if(server.syncedRoles?.some(r => r.name === name && r.isGroup === isGroup))
                return interaction.editReplyTl(keys.commands.rolesync.errors.team_group_already_synced);

            await fetchMembersIfCacheDiffers(client, interaction.guild);

            const resp = await server.protocol.addSyncedRole({
                id: role.id,
                name,
                isGroup,
                direction,
                players: role.members.map(m => client.userConnections.cache.get(m.id)?.getUUID(server)).filter(u => u),
            });
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction, {
                [ProtocolError.NOT_FOUND]: keys.commands.rolesync.errors.group_or_team_not_found,
                [ProtocolError.LUCKPERMS_NOT_LOADED]: keys.commands.rolesync.errors.luckperms_not_loaded,
            }, { name })) return;

            const respRoleIndex = resp.data.findIndex(r => r.id === role.id);
            const respRole = resp.data[respRoleIndex];

            // Only grant Discord roles if direction allows MC→Discord sync
            if(direction !== 'to_minecraft') {
                //Map uuids to discord ids
                const userIds = respRole.players.map(p => client.userConnections.cache.find(u => u.getUUID(server) === p)?.id).filter(u => u);

                //Add the role to the members that are in the group
                const membersToAdd = userIds.filter(id => !role.members.has(id));
                for(const member of membersToAdd) {
                    try {
                        const discordMember = await interaction.guild.members.fetch(member);
                        await discordMember.roles.add(role);
                    }
                    catch(err) {
                        logger.error(err, `Failed to add Discord role during rolesync setup`);
                    }
                }

                if(direction === 'to_discord') {
                    //Remove the role from members that are not in the group
                    const membersToRemove = role.members.filter(m => !userIds.includes(m.id));
                    for(const member of membersToRemove) {
                        try {
                            const discordMember = await interaction.guild.members.fetch(member.id);
                            await discordMember.roles.remove(role);
                        }
                        catch(err) {
                            logger.error(err, `Failed to remove Discord role during rolesync setup`);
                        }
                    }
                }
            }

            if(direction === 'to_minecraft')
                respRole.players = role.members.map(m => client.userConnections.cache.get(m.id)?.getUUID(server)).filter(u => u);
            respRole.direction = direction;
            resp.data[respRoleIndex] = respRole;

            await server.edit({ syncedRoles: resp.data });
            return interaction.editReplyTl(keys.commands.rolesync.success.add);
        }

        else if(subcommand === 'remove') {
            const role = args[1];

            const syncedRole = server.syncedRoles?.find(c => c.id === role.id);
            if(!syncedRole) return interaction.editReplyTl(keys.commands.rolesync.warnings.role_not_added);

            const resp = await server.protocol.removeSyncedRole(syncedRole);
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

            await server.edit({ syncedRoles: resp.data });
            return interaction.editReplyTl(keys.commands.rolesync.success.remove);
        }
        else if(subcommand === 'list') {
            if(!server.syncedRoles?.length) return interaction.editReplyTl(keys.commands.rolesync.warnings.no_roles);

            /** @type {PaginationPages} */
            const pages = {};

            for(const role of server.syncedRoles) {
                let directionLabel;
                if(role.direction === 'to_minecraft') directionLabel = keys.commands.rolesync.direction_to_minecraft;
                else if(role.direction === 'to_discord') directionLabel = keys.commands.rolesync.direction_to_discord;
                else directionLabel = keys.commands.rolesync.direction_both;

                const roleEmbed = getEmbed(
                    keys.commands.rolesync.success.list,
                    ph.std(interaction),
                    {
                        role: await interaction.guild.roles.fetch(role.id),
                        group_or_team: role.isGroup ? keys.commands.rolesync.group : keys.commands.rolesync.team,
                        group_or_team_value: role.name,
                        member_count: role.players.length,
                        direction: directionLabel,
                    },
                );

                const index = server.syncedRoles.indexOf(role);
                const roleButton = getComponent(keys.commands.rolesync.success.role_button, {
                    index1: index + 1,
                    index: index,
                });

                pages[roleButton.data.custom_id] = {
                    options: { embeds: [roleEmbed] },
                    button: roleButton,
                };
            }

            const pagination = new Pagination(client, interaction, pages, {
                highlightSelectedButton: ButtonStyle.Primary,
            });
            return pagination.start();
        }
    }
}
