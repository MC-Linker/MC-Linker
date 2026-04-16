import { verifySession } from '../utils/auth';
import { getConnection, parseDateRange, parseIntParam } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const { from, to } = parseDateRange(query);
    const limit = parseIntParam(query.limit, 25, 100);

    const snapshots = await conn.models.AnalyticsSnapshot
        .find({ timestamp: { $gte: from, $lte: to } })
        .select('commands')
        .lean();

    // Merge command arrays across all snapshots
    const merged: Record<string, { count: number; errors: number; totalDurationMs: number }> = {};
    for (const s of snapshots) {
        for (const cmd of s.commands as { name: string; count: number; errors: number; avgDurationMs: number }[]) {
            const entry = merged[cmd.name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
            entry.count += cmd.count;
            entry.errors += cmd.errors;
            entry.totalDurationMs += cmd.avgDurationMs * cmd.count;
        }
    }

    const commands = Object.entries(merged)
        .map(([name, data]) => ({
            name,
            count: data.count,
            errors: data.errors,
            errorRate: data.count > 0 ? Math.round((data.errors / data.count) * 100) : 0,
            avgDurationMs: data.count > 0 ? Math.round(data.totalDurationMs / data.count) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    return { commands };
});
