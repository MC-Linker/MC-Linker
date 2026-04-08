import { verifySession } from '../utils/auth';
import { getConnection } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const from = query.from ? new Date(query.from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to as string + 'T23:59:59.999Z') : new Date();

    const snapshots = await conn.models.AnalyticsSnapshot
        .find({ timestamp: { $gte: from, $lte: to } })
        .sort({ timestamp: 1 })
        .select('timestamp chatMonitor')
        .lean();

    // Aggregate rate limits and operations across all snapshots
    const rateLimitTotals: Record<string, number> = {};
    let totalRateLimits = 0;
    let totalFailures = 0;
    const opTotals: Record<string, { count: number; rateLimits: number }> = {};

    for (const snap of snapshots) {
        const cm = snap.chatMonitor as any;
        if (!cm) continue;

        // Rate limits
        const rl = cm.rateLimits;
        if (rl) {
            const entries = rl instanceof Map ? rl.entries() : Object.entries(rl);
            for (const [cat, count] of entries) {
                rateLimitTotals[cat] = (rateLimitTotals[cat] ?? 0) + (count as number);
                totalRateLimits += count as number;
            }
        }

        // Failures
        totalFailures += (cm.failures?.permission ?? 0) + (cm.failures?.creation ?? 0);

        // Operations
        for (const op of cm.operations ?? []) {
            const entry = opTotals[op.name] ??= { count: 0, rateLimits: 0 };
            entry.count += op.count;
            entry.rateLimits += op.rateLimits;
        }
    }

    const operations = Object.entries(opTotals)
        .map(([name, v]) => ({ name, count: v.count, rateLimits: v.rateLimits }))
        .sort((a, b) => b.count - a.count);

    // Time series for charts
    const timeSeries = snapshots.map(s => {
        const cm = s.chatMonitor as any;
        const tp = cm?.throughput;
        const q = cm?.queue;
        const f = cm?.failures;

        let rlTotal = 0;
        const rl = cm?.rateLimits;
        if (rl) {
            const values = rl instanceof Map ? rl.values() : Object.values(rl);
            for (const v of values) rlTotal += v as number;
        }

        return {
            timestamp: s.timestamp,
            incoming: tp?.incoming ?? 0,
            enqueued: tp?.enqueued ?? 0,
            processed: tp?.processed ?? 0,
            queueItems: q?.items ?? 0,
            queueDestinations: q?.destinations ?? 0,
            rateLimits: rlTotal,
            failures: (f?.permission ?? 0) + (f?.creation ?? 0),
        };
    });

    // Latest snapshot for stats cards
    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const latestCm = latest?.chatMonitor as any;

    return {
        timeSeries,
        totals: {
            rateLimits: totalRateLimits,
            failures: totalFailures,
            rateLimitsByCategory: rateLimitTotals,
        },
        operations,
        latest: latestCm ? {
            incoming: latestCm.throughput?.incoming ?? 0,
            processed: latestCm.throughput?.processed ?? 0,
            queueItems: latestCm.queue?.items ?? 0,
            queueDestinations: latestCm.queue?.destinations ?? 0,
        } : null,
    };
});
