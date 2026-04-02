import WSEvent from '../WSEvent.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';
import { fetchMembersIfCacheDiffers } from '../../utilities/utils.js';


export default class SyncSyncedRoleMembers extends WSEvent {

    constructor() {
        super({
            event: 'sync-synced-role-members',
        });
    }

    /**
     * @typedef {Object} SyncSyncedRoleMembersRequest
     * @property {string} id - The ID of the synced role.
     * @property {string[]} players - The current player UUIDs in the team/group on the MC side.
     */

    /**
     * @typedef {Object} SyncSyncedRoleMembersResponse
     * @property {'success'|'error'} status - The status of the response.
     * @property {{ added: string[], removed: string[] }} [data] - The players that need to be added/removed on the non-authoritative side.
     * @property {string} [error] - The error code (present on error).
     */

    /**
     * @inheritdoc
     * @param {SyncSyncedRoleMembersRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        const roleIndex = server.syncedRoles.findIndex(r => r.id === data.id);
        if(roleIndex === -1) return { status: 'error', error: ProtocolError.NOT_FOUND };

        const syncedRole = server.syncedRoles[roleIndex];
        const direction = syncedRole.direction ?? 'both';

        let guild;
        let discordRole;
        try {
            guild = await client.guilds.fetch(server.id);

            discordRole = await guild.roles.fetch(data.id);
            if(!discordRole) return { status: 'error', error: ProtocolError.NOT_FOUND };

            await fetchMembersIfCacheDiffers(client, guild);
        }
        catch(err) {
            logger.error({ err, guildId: server.id }, `Failed to fetch guild ${server.id} for synced role sync`);
            return { status: 'error', error: ProtocolError.UNKNOWN };
        }

        // Build map of player UUID → Discord member for all members that currently have the Discord role
        const discordPlayerUUIDs = new Map();
        for(const [memberId, member] of discordRole.members) {
            const userConn = client.userConnections.cache.get(memberId);
            if(userConn) discordPlayerUUIDs.set(userConn.getUUID(server), member);
            else {
                // If authoritative side is Discord, remove this member from the role
                if(direction === 'to_discord') {
                    try {
                        await member.roles.remove(discordRole);
                    }
                    catch(err) {
                        logger.error({
                            err,
                            guildId: server.id,
                        }, `Failed to revoke Discord role ${data.id} from unknown user ${memberId} during sync`);
                    }
                }
            }
        }

        const mcPlayers = data.players;
        const mcSet = new Set(mcPlayers);
        const added = []; // Have Discord role but NOT in MC list → mod should add
        const removed = []; // In MC list but do NOT have Discord role → mod should remove

        // Players in MC list but missing the Discord role
        for(const uuid of mcPlayers) {
            if(!discordPlayerUUIDs.has(uuid)) {
                if(direction === 'both' || direction === 'to_discord') {
                    // MC is authoritative for this direction → grant Discord role
                    const conn = client.userConnections.cache.find(u => u.getUUID(server) === uuid);
                    if(conn) {
                        try {
                            if(!syncedRole.players.includes(uuid)) {
                                // Add to synced role's player list
                                syncedRole.players.push(uuid);
                                server.syncedRoles[roleIndex] = syncedRole;
                                // Required to do before to prevent feedback loop in GuildMemberUpdateEvent
                                await server.edit({});
                            }

                            const member = await guild.members.fetch(conn.id);
                            await member.roles.add(discordRole);
                        }
                        catch(err) {
                            logger.error({
                                err,
                                guildId: server.id,
                            }, `Failed to grant Discord role ${data.id} to ${uuid} during sync`);

                            // Revert players list change if role grant fails
                            if(syncedRole.players.includes(uuid)) {
                                syncedRole.players = syncedRole.players.filter(p => p !== uuid);
                                server.syncedRoles[roleIndex] = syncedRole;
                                await server.edit({});
                            }
                        }
                    }
                }
                else {
                    // direction === 'to_minecraft' → Discord is authoritative, mod should remove
                    removed.push(uuid);
                }
            }
        }

        // Players with the Discord role but NOT in MC list
        for(const [uuid, member] of discordPlayerUUIDs) {
            if(!mcSet.has(uuid)) {
                if(direction === 'to_discord') {
                    // MC is authoritative → revoke Discord role
                    try {
                        if(syncedRole.players.includes(uuid)) {
                            // Remove from synced role's player list
                            syncedRole.players = syncedRole.players.filter(p => p !== uuid);
                            server.syncedRoles[roleIndex] = syncedRole;
                            // Required to do before to prevent feedback loop in GuildMemberUpdateEvent
                            await server.edit({});
                        }

                        await member.roles.remove(discordRole);
                    }
                    catch(err) {
                        logger.error({
                            err,
                            guildId: server.id,
                        }, `Failed to revoke Discord role ${data.id} from ${uuid} during sync`);

                        // Revert players list change if role revoke fails
                        if(!syncedRole.players.includes(uuid)) {
                            syncedRole.players.push(uuid);
                            server.syncedRoles[roleIndex] = syncedRole;
                            await server.edit({});
                        }
                    }
                }
                else {
                    // direction === 'both' or 'to_minecraft' → mod should add
                    added.push(uuid);
                }
            }
        }

        // Update stored players to the union of both sides (for 'both') or the authoritative side
        if(direction === 'to_discord') {
            // MC is authoritative
            syncedRole.players = [...mcPlayers];
        }
        else if(direction === 'to_minecraft') {
            // Discord is authoritative
            syncedRole.players = [...discordPlayerUUIDs.keys()];
        }
        else {
            // both → union of MC + Discord
            syncedRole.players = [...new Set([...mcPlayers, ...discordPlayerUUIDs.keys()])];
        }
        await server.edit({});

        return { status: 'success', data: { added, removed } };
    }
}
