import Event from '../structures/Event.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord guildMemberUpdate event for the MC-Linker bot.
 * Syncs roles and enforces required roles for Minecraft server access.
 */
export default class GuildMemberUpdate extends Event {
    constructor() {
        super({
            name: Events.GuildMemberUpdate,
        });
    }

    async execute(client, oldMember, newMember) {
        if(!oldMember.roles) return;
        if(oldMember.roles.cache.size === newMember.roles.cache.size) return;

        const server = client.serverConnections.cache.get(newMember.guild.id);
        if(!server) return;
        const roleIndex = server.syncedRoles.findIndex(r => r.id === changedRoleId);
        if(roleIndex === -1) return;
        const syncedRole = server.syncedRoles[roleIndex];

        const addedRole = newMember.roles.cache.find(role => !oldMember.roles.cache.has(role.id));
        const removedRole = oldMember.roles.cache.find(role => !newMember.roles.cache.has(role.id));

        // Cancel event if direction is to_discord (MC→Discord only, Discord changes shouldn't propagate to MC)
        if(syncedRole.direction === 'to_discord') {
            // Re-add the removed role if mc is authoritative
            if(addedRole) newMember.roles.remove(addedRole.id).catch(() => {});
            // Remove the added role if mc is authoritativee
            if(removedRole) newMember.roles.add(removedRole.id).catch(() => {});
            return;
        }

        const user = client.userConnections.cache.get(newMember.id);
        if(!user) return;

        if(server.requiredRoleToJoin) {
            if(
                server.requiredRoleToJoin.method === 'any' && !server.requiredRoleToJoin.roles.some(id => newMember.roles.cache.has(id)) ||
                server.requiredRoleToJoin.method === 'all' && !server.requiredRoleToJoin.roles.every(id => newMember.roles.cache.has(id))
            ) await server.protocol.execute(`kick ${user.username} §cYou do not have the required role to join this server`);
        }

        const changedRoleId = addedRole?.id ?? removedRole?.id;

        let resp;
        if(addedRole) resp = await server.protocol.addSyncedRoleMember(syncedRole, user.uuid);
        else if(removedRole) resp = await server.protocol.removeSyncedRoleMember(syncedRole, user.uuid);
        if(!resp || resp.status !== 'success') return;

        syncedRole.players = resp.data;
        server.syncedRoles[roleIndex] = syncedRole;
        await server.edit({});
    }
} 