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
        .select('timestamp guilds')
        .lean();

    const timeSeries = snapshots.map(s => ({
        timestamp: s.timestamp,
        total: s.guilds.total,
        joined: s.guilds.joined,
        left: s.guilds.left,
    }));

    const latest = snapshots[snapshots.length - 1] ?? null;

    return {
        timeSeries,
        latest: latest ? {
            total: latest.guilds.total,
            joined: latest.guilds.joined,
            left: latest.guilds.left,
        } : null,
    };
});
