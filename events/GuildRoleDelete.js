import Event from '../structures/Event.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord guildMemberUpdate event for the MC-Linker bot.
 * Syncs roles and enforces required roles for Minecraft server access.
 */
export default class GuildMemberUpdate extends Event {
    constructor() {
        super({
            name: Events.GuildRoleDelete,
        });
    }

    async execute(client, role) {
        const server = client.serverConnections.cache.get(role.guild.id);
        if(!server) return;

        const roleIndex = server.syncedRoles.findIndex(r => r.id === role.id);
        if(roleIndex === -1) return;

        server.syncedRoles.splice(roleIndex, 1);
        await server.protocol.removeSyncedRole(server.syncedRoles[roleIndex]);
        await server.edit({});
    }
} 