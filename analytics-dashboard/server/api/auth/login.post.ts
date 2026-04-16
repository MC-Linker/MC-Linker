import crypto from 'node:crypto';
import { createSessionToken, setSessionCookie } from '../../utils/auth';

export default defineEventHandler(async event => {
    const { password, db } = await readBody(event);
    const config = useRuntimeConfig();

    const expected = config.dashboardPassword;
    if (!password || typeof password !== 'string' || !expected
        || Buffer.byteLength(password) !== Buffer.byteLength(expected)
        || !crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected)))
        throw createError({ status: 401, message: 'Invalid password' });

    if (!db || typeof db !== 'string')
        throw createError({ status: 400, message: 'Database name required' });

    const token = await createSessionToken(db);
    setSessionCookie(event, token);
    return { ok: true };
});
