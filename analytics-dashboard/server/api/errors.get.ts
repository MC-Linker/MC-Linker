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

    const groups = await conn.models.AnalyticsError.aggregate([
        { $match: filter },
        { $sort: { timestamp: -1 } },
        {
            $group: {
                _id: { type: '$type', name: '$name', message: '$error.message' },
                count: { $sum: 1 },
                lastSeen: { $first: '$timestamp' },
                stack: { $first: '$error.stack' },
                occurrences: {
                    $push: {
                        timestamp: '$timestamp',
                        guildId: '$guildId',
                        userId: '$userId',
                        shardId: '$shardId',
                    },
                },
            },
        },
        { $sort: { lastSeen: -1 } },
        {
            $project: {
                _id: 0,
                type: '$_id.type',
                name: '$_id.name',
                message: '$_id.message',
                count: 1,
                lastSeen: 1,
                stack: 1,
                occurrences: { $slice: ['$occurrences', 50] },
            },
        },
    ]);

    return { groups };
});
