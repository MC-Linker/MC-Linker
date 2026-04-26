import { verifySession } from '../utils/auth';
import { getConnection, parseDateRange, parseIntParam } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const { from, to } = parseDateRange(query);
    const page = parseIntParam(query.page, 1);
    const limit = parseIntParam(query.limit, 50, 200);
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
