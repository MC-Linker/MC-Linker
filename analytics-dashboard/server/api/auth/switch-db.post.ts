import { createSessionToken, setSessionCookie, verifySession } from '../../utils/auth';
import { listAnalyticsDatabases } from '../../utils/db';

export default defineEventHandler(async event => {
    await verifySession(event); // Must already be logged in
    const { db } = await readBody(event);
    if (!db || typeof db !== 'string')
        throw createError({ status: 400, message: 'Database name required' });

    const validDbs = await listAnalyticsDatabases();
    if (!validDbs.includes(db))
        throw createError({ status: 400, message: 'Invalid database name' });

    const token = await createSessionToken(db);
    setSessionCookie(event, token);
    return { ok: true, db };
});
