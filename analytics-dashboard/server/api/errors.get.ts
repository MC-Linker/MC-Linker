import { verifySession } from '../utils/auth';
import { getConnection } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const from = query.from ? new Date(query.from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to as string + 'T23:59:59.999Z') : new Date();
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Number(query.limit ?? 50), 200);
    const type = query.type as string | undefined;

    const filter: Record<string, unknown> = { timestamp: { $gte: from, $lte: to } };
    if (type) filter.type = type;

    const [total, errors] = await Promise.all([
        conn.models.AnalyticsError.countDocuments(filter),
        conn.models.AnalyticsError
            .find(filter)
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
    ]);

    return {
        errors,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
});
