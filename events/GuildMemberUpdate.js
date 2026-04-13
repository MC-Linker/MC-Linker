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

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').GuildMember, import('discord.js').GuildMember]} args - [0] The old member data, [1] The new member data.
     * @param logger
     */
    async run(client, [oldMember, newMember], logger) {
        if(!oldMember.roles) return;
        if(oldMember.roles.cache.size === newMember.roles.cache.size) return;

        const server = client.serverConnections.cache.get(newMember.guild.id);
        if(!server) return;

        const user = client.userConnections.cache.get(newMember.id);
        const uuid = user?.getUUID(server);

        // Required Role To Join
        if(server.requiredRoleToJoin && user) {
            if(!server.hasRequiredRole(newMember))
                await server.protocol.execute(`kick ${user.username} §cYou do not have the required role to join this server`);
        }

        const addedRole = newMember.roles.cache.find(role => !oldMember.roles.cache.has(role.id));
        const removedRole = oldMember.roles.cache.find(role => !newMember.roles.cache.has(role.id));
        const changedRoleId = addedRole?.id ?? removedRole?.id;

        const roleIndex = server.syncedRoles.findIndex(r => r.id === changedRoleId);
        if(roleIndex === -1) return;
        const syncedRole = server.syncedRoles[roleIndex];

        // Synced Roles
        const noChangeToPlayers = uuid ?
            addedRole && syncedRole.players.includes(uuid) ||
            removedRole && !syncedRole.players.includes(uuid) : false;

        // Cancel events if mc is authoritative
        if(syncedRole.direction === 'to_discord') {
            // Re-remove the added role if user isnt linked or if the change is not reflected in the players array already (change was bot-initiated)
            if((!user || !noChangeToPlayers) && addedRole) newMember.roles.remove(addedRole.id).catch(err => client.analytics.trackError('api_ws', 'GuildMemberUpdate', newMember.guild.id, newMember.id, err, {
                roleId: addedRole.id,
                action: 're-remove',
            }, logger));
            // Re-add the removed role if the change is not reflected in the players array already (change was bot-initiated)
            else if(removedRole && !noChangeToPlayers) newMember.roles.add(removedRole.id).catch(err => client.analytics.trackError('api_ws', 'GuildMemberUpdate', newMember.guild.id, newMember.id, err, {
                roleId: removedRole.id,
                action: 're-add',
            }, logger));
            return;
        }

        if(!user) return;
        // Skip if the change is already reflected in players — this was a bot-initiated update
        if(noChangeToPlayers) return;

        let resp;
        if(addedRole) resp = await server.protocol.addSyncedRoleMember(syncedRole, uuid);
        else if(removedRole) resp = await server.protocol.removeSyncedRoleMember(syncedRole, uuid);
        if(!resp || resp.status !== 'success') return;

        syncedRole.players = resp.data;
        server.syncedRoles[roleIndex] = syncedRole;
        await server.edit({});
    }
}
