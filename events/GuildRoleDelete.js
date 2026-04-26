import Event from '../structures/Event.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord guildRoleDelete event for the MC-Linker bot.
 * Removes synced roles from the server connection when the Discord role is deleted.
 */
export default class GuildRoleDelete extends Event {
    constructor() {
        super({
            name: Events.GuildRoleDelete,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').Role]} args - [0] The role.
     * @param logger
     */
    async run(client, [role], logger) {
        const server = client.serverConnections.cache.get(role.guild.id);
        if(!server) return;

        const roleIndex = server.syncedRoles.findIndex(r => r.id === role.id);
        if(roleIndex === -1) return;

        await server.protocol.removeSyncedRole(server.syncedRoles[roleIndex]);
        await server.edit({ syncedRoles: server.syncedRoles.filter(r => r.id !== role.id) });
    }
} 