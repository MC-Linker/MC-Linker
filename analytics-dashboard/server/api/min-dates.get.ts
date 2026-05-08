import { verifySession } from '../utils/auth';
import { getConnection } from '../utils/db';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    const conn = getConnection(db);

    const [snapshot, error] = await Promise.all([
        conn.models.AnalyticsSnapshot.findOne({}).sort({ timestamp: 1 }).select('timestamp').lean(),
        conn.models.AnalyticsError.findOne({}).sort({ timestamp: 1 }).select('timestamp').lean(),
    ]);

    return {
        snapshots: snapshot?.timestamp ? (snapshot.timestamp as Date).toISOString().slice(0, 10) : null,
        errors: error?.timestamp ? (error.timestamp as Date).toISOString().slice(0, 10) : null,
    };
});
