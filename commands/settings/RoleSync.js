import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import keys from '../../api/keys.js';
import * as utils from '../../api/utils.js';
import { getComponent, getEmbed, ph } from '../../api/messages.js';
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
            const override = args[3];

            if(!role.editable) return interaction.replyTl(keys.commands.rolesync.errors.not_editable, { role });

            const resp = await server.protocol.addSyncedRole({
                id: role.id,
                name,
                isGroup,
                players: override === 'role' ? null : role.members.map(m => client.userConnections.cache.get(m.id)?.uuid).filter(u => u),
            });
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction, {
                404: keys.commands.rolesync.errors.group_not_found,
                501: keys.commands.rolesync.errors.luckperms_not_loaded,
            }, { name })) return;

            if(override === 'role') {
                const respRole = resp.data.find(r => r.id === role.id);
                //Map uuids to discord ids
                const userIds = respRole.players.map(p => client.userConnections.cache.find(u => u.username.toLowerCase() === p.toLowerCase())?.id).filter(u => u);

                // Override role members with the group members
                const membersToRemove = role.members.map(m => m.id).filter(id => !userIds.includes(id));
                const membersToAdd = userIds.filter(id => !role.members.has(id));

                for(const member of membersToRemove) await role.members.get(member).roles.remove(role);
                for(const member of membersToAdd) await interaction.guild.members.cache.get(member).roles.add(role);
            }

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

                const index = server.chatChannels.indexOf(role);
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
