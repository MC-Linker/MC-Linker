import { verifySession } from '../utils/auth';
import { getConnection } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const from = query.from ? new Date(query.from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to as string) : new Date();

    const snapshots = await conn.models.AnalyticsSnapshot
        .find({ timestamp: { $gte: from, $lte: to } })
        .select('timestamp apiCalls')
        .sort({ timestamp: 1 })
        .lean();

    // Merge REST calls across all snapshots
    const mergedRest: Record<string, { count: number; totalDurationMs: number }> = {};
    const mergedWs: Record<string, { count: number; errors: number; totalDurationMs: number }> = {};

    for (const s of snapshots) {
        for (const r of (s.apiCalls?.rest ?? []) as { name: string; count: number; avgDurationMs: number }[]) {
            const entry = mergedRest[r.name] ??= { count: 0, totalDurationMs: 0 };
            entry.count += r.count;
            entry.totalDurationMs += r.avgDurationMs * r.count;
        }
        for (const w of (s.apiCalls?.ws ?? []) as {
            name: string;
            count: number;
            errors: number;
            avgDurationMs: number
        }[]) {
            const entry = mergedWs[w.name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
            entry.count += w.count;
            entry.errors += w.errors;
            entry.totalDurationMs += w.avgDurationMs * w.count;
        }
    }

    const rest = Object.entries(mergedRest)
        .map(([name, d]) => ({
            name,
            count: d.count,
            avgDurationMs: d.count > 0 ? Math.round(d.totalDurationMs / d.count) : 0,
        }))
        .sort((a, b) => b.count - a.count);

    const ws = Object.entries(mergedWs)
        .map(([name, d]) => ({
            name,
            count: d.count,
            errors: d.errors,
            errorRate: d.count > 0 ? Math.round((d.errors / d.count) * 100) : 0,
            avgDurationMs: d.count > 0 ? Math.round(d.totalDurationMs / d.count) : 0,
        }))
        .sort((a, b) => b.count - a.count);

    // Time series for volume chart
    const timeSeries = snapshots.map(s => {
        const restTotal = ((s.apiCalls?.rest ?? []) as { count: number }[]).reduce((sum, r) => sum + r.count, 0);
        const wsTotal = ((s.apiCalls?.ws ?? []) as { count: number }[]).reduce((sum, r) => sum + r.count, 0);
        return { timestamp: s.timestamp, rest: restTotal, ws: wsTotal };
    });

    return { rest, ws, timeSeries };
});
