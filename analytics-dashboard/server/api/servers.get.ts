import { verifySession } from '../utils/auth';
import { getConnection } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const search = query.search as string | undefined;

    const servers = await conn.models.ServerConnection.find().lean();

    // Compute aggregate stats
    let chatChannels = 0;
    let statChannels = 0;
    let syncedRoles = 0;
    let requiredRole = 0;
    let floodgate = 0;
    const chatTypeBreakdown: Record<string, number> = {};
    const roleDirections: Record<string, number> = { both: 0, to_minecraft: 0, to_discord: 0 };
    const requiredRoleBreakdown: Record<string, number> = { 'Require Roles': 0, 'Linked Account Only': 0 };

    for (const s of servers) {
        if ((s.chatChannels as any[])?.length > 0) {
            chatChannels++;
            for (const ch of s.chatChannels as any[]) {
                for (const t of (ch.types ?? []) as string[]) {
                    chatTypeBreakdown[t] = (chatTypeBreakdown[t] ?? 0) + 1;
                }
            }
        }
        if ((s.statChannels as any[])?.length > 0) statChannels++;
        if ((s.syncedRoles as any[])?.length > 0) {
            syncedRoles++;
            for (const r of s.syncedRoles as any[]) {
                const dir = (r.direction ?? 'both') as string;
                if (dir in roleDirections) roleDirections[dir]++;
            }
        }
        const rr = s.requiredRoleToJoin as any;
        if (rr?.roles?.length > 0) {
            requiredRole++;
            requiredRoleBreakdown['Require Roles']++;
        }
        else if (rr?.requireLinked) {
            requiredRole++;
            requiredRoleBreakdown['Linked Account Only']++;
        }
        if (s.floodgatePrefix) floodgate++;
    }

    // Search for specific server
    let server = null;
    if (search) {
        server = servers.find((s: any) => s._id === search) ?? null;
    }

    return {
        total: servers.length,
        stats: {
            chatChannels,
            statChannels,
            syncedRoles,
            requiredRole,
            floodgate,
            chatTypeBreakdown,
            roleDirections,
            requiredRoleBreakdown,
        },
        server,
    };
});
