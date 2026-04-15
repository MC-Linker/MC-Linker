import { createSessionToken, setSessionCookie, verifySession } from '../../utils/auth';

export default defineEventHandler(async event => {
    await verifySession(event); // Must already be logged in
    const { db } = await readBody(event);
    if (!db || typeof db !== 'string')
        throw createError({ status: 400, message: 'Database name required' });

    const token = await createSessionToken(db);
    setSessionCookie(event, token);
    return { ok: true, db };
});
