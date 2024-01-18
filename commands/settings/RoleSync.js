import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { MaxAutoCompleteChoices } from '../../utilities/utils.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';

export default class RoleSync extends AutocompleteCommand {

    constructor() {
        super({
            name: 'rolesync',
            category: 'settings',
            requiresConnectedPlugin: true,
        });
    }

    async autocomplete(interaction, client) {
        if(interaction.options.getSubcommand() !== 'add') return;

        const server = client.serverConnections.cache.get(interaction.guildId);
        if(!server || !server.protocol.isPluginProtocol()) return;

        const response = await server.protocol.getTeamsAndGroups();
        if(response?.status !== 200) return;

        const commandResponse = [];
        for(const group of response.data.groups) {
            if(!group.includes(interaction.options.getFocused())) continue;
            commandResponse.push({
                name: `${group} (Group)`,
                value: `${group} group`,
            });
        }
        for(const team of response.data.teams) {
            if(!team.includes(interaction.options.getFocused())) continue;
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
        if(!server.protocol.isPluginProtocol()) return; // just for type safety

        const subcommand = args[0];
        if(subcommand === 'add') {
            /** @type {import('discord.js').Role} */
            const role = args[1];
            const name = args[2].split(' ')[0];
            const isGroup = args[2].split(' ')[1] === 'group'; //If nothing is specified, default to team

            if(!role.editable) return interaction.replyTl(keys.commands.rolesync.errors.not_editable, { role });

            // Fetch all members to ensure their roles are cached
            await interaction.guild.members.fetch();

            const resp = await server.protocol.addSyncedRole({
                id: role.id,
                name,
                isGroup,
                players: role.members.map(m => client.userConnections.cache.get(m.id)?.uuid).filter(u => u),
            });
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction, {
                404: keys.commands.rolesync.errors.group_not_found,
                501: keys.commands.rolesync.errors.luckperms_not_loaded,
            }, { name })) return;

            const respRole = resp.data.find(r => r.id === role.id);
            //Map uuids to discord ids
            const userIds = respRole.players.map(p => client.userConnections.cache.find(u => u.uuid === p)?.id).filter(u => u);

            //Add the role to the members that are in the group
            const membersToAdd = userIds.filter(id => !role.members.has(id));
            for(const member of membersToAdd) {
                try {
                    const discordMember = await interaction.guild.members.fetch(member);
                    await discordMember.roles.add(role);
                }
                catch(ignored) {}
            }

            const respRoleIndex = resp.data.indexOf(respRole);
            respRole.players = role.members.map(m => client.userConnections.cache.get(m.id)?.uuid).filter(u => u);
            resp.data[respRoleIndex] = respRole;

            await server.edit({ syncedRoles: resp.data });
            return interaction.replyTl(keys.commands.rolesync.success.add, ph.emojisAndColors());
        }

        else if(subcommand === 'remove') {
            const role = args[1];

            const syncedRole = server.syncedRoles?.find(c => c.id === role.id);
            if(!syncedRole) return interaction.replyTl(keys.commands.rolesync.warnings.role_not_added);

            const resp = await server.protocol.removeSyncedRole(syncedRole);
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

            await server.edit({ syncedRoles: resp.data });
            return interaction.replyTl(keys.commands.rolesync.success.remove);
        }
        else if(subcommand === 'list') {
            if(!server.syncedRoles?.length) return interaction.replyTl(keys.commands.rolesync.warnings.no_roles);

            /** @type {PaginationPages} */
            const pages = {};

            for(const role of server.syncedRoles) {
                const roleEmbed = getEmbed(
                    keys.commands.rolesync.success.list,
                    ph.std(interaction),
                    {
                        role: await interaction.guild.roles.fetch(role.id),
                        group_or_team: role.isGroup ? keys.commands.rolesync.group : keys.commands.rolesync.team,
                        group_or_team_value: role.name,
                        member_count: role.players.length,
                    },
                );

                const index = server.syncedRoles.indexOf(role);
                const roleButton = getComponent(keys.commands.rolesync.success.role_button, {
                    index1: index + 1,
                    index: index,
                });

                pages[roleButton.data.custom_id] = {
                    page: { embeds: [roleEmbed] },
                    button: roleButton,
                };
            }

            const pagination = new Pagination(client, interaction, pages);
            return pagination.start();
        }
    }
}
