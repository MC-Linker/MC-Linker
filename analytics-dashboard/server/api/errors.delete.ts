import { verifySession } from '../utils/auth';
import { getConnection, parseDateRange } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const query = getQuery(event);
    const conn = getConnection(db);

    const { from, to } = parseDateRange(query);
    const type = query.type as string | undefined;

    const filter: Record<string, unknown> = { timestamp: { $gte: from, $lte: to } };
    if (type) filter.type = type;

    const { deletedCount } = await conn.models.AnalyticsError.deleteMany(filter);
    return { deleted: deletedCount };
});
