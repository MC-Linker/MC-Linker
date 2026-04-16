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
        .select('shards timestamp connections machine')
        .lean();

    const latest = snapshots[snapshots.length - 1] ?? null;

    // Build per-shard time series for memory/CPU charts
    const timeSeries = snapshots.map(s => ({
        timestamp: s.timestamp,
        machine: s.machine ?? { cpuPercent: 0, memoryUsedMB: 0, memoryTotalMB: 0 },
        shards: (s.shards as { id: number; memoryMB: number; cpuPercent: number }[]).map(sh => ({
            id: sh.id,
            memoryMB: sh.memoryMB,
            cpuPercent: sh.cpuPercent ?? 0,
        })),
    }));

    return {
        timestamp: latest?.timestamp ?? null,
        shards: latest?.shards ?? [],
        machine: latest?.machine ?? { cpuPercent: 0, memoryUsedMB: 0, memoryTotalMB: 0 },
        connections: latest?.connections ?? null,
        timeSeries,
    };
});
