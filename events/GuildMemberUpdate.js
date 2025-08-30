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
        const user = client.userConnections.cache.get(newMember.id);
        if(!user) return;
        const server = client.serverConnections.cache.get(newMember.guild.id);
        if(!server) return;
        const addedRole = newMember.roles.cache.find(role => !oldMember.roles.cache.has(role.id));
        const removedRole = oldMember.roles.cache.find(role => !newMember.roles.cache.has(role.id));
        if(server.requiredRoleToJoin) {
            if(
                server.requiredRoleToJoin.method === 'any' && !server.requiredRoleToJoin.roles.some(id => newMember.roles.cache.has(id)) ||
                server.requiredRoleToJoin.method === 'all' && !server.requiredRoleToJoin.roles.every(id => newMember.roles.cache.has(id))
            ) await server.protocol.execute(`kick ${user.username} §cYou do not have the required role to join this server`);
        }
        const role = server.syncedRoles?.find(role => role.id === addedRole?.id || role.id === removedRole?.id);
        if(!role) return;
        let resp;
        if(addedRole) resp = await server.protocol.addSyncedRoleMember(role, user.uuid);
        if(removedRole) resp = await server.protocol.removeSyncedRoleMember(role, user.uuid);
        const roleIndex = server.syncedRoles.findIndex(r => r.id === role.id);
        if(roleIndex === -1) return;
        role.players = resp.data;
        server.syncedRoles[roleIndex] = role;
        if(resp.status === 200) await server.edit({});
    }
} 