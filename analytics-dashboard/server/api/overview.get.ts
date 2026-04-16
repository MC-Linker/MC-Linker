import { verifySession } from '../utils/auth';
import { getConnection, parseDateRange } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const { from, to } = parseDateRange(query);

    const snapshots = await conn.models.AnalyticsSnapshot
        .find({ timestamp: { $gte: from, $lte: to } })
        .sort({ timestamp: 1 })
        .lean();

    // Latest snapshot for current totals
    const latest = snapshots[snapshots.length - 1] ?? null;

    // Aggregate totals over range
    const totalCommands = snapshots.reduce((sum, s) => sum + s.commands.reduce((c: number, cmd: {
        count: number
    }) => c + cmd.count, 0), 0);
    const totalErrors = snapshots.reduce((sum, s) => sum + s.commands.reduce((c: number, cmd: {
        errors: number
    }) => c + cmd.errors, 0), 0);

    // Time-series for charts: [{timestamp, guilds, commands}]
    const timeSeries = snapshots.map(s => ({
        timestamp: s.timestamp,
        guilds: s.guilds.total,
        approximate_users: s.users.approximate,
        commands: s.commands.reduce((c: number, cmd: { count: number }) => c + cmd.count, 0),
        errors: s.commands.reduce((c: number, cmd: { errors: number }) => c + cmd.errors, 0),
    }));

    return {
        latest: latest ? {
            guilds: latest.guilds,
            users: latest.users,
            connections: latest.connections,
            shardCount: latest.shards.length,
        } : null,
        totals: { commands: totalCommands, errors: totalErrors },
        timeSeries,
    };
});
