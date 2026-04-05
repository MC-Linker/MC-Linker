import { createSessionToken, setSessionCookie } from '../../utils/auth';

export default defineEventHandler(async event => {
    const { password, db } = await readBody(event);
    const config = useRuntimeConfig();

    if (!password || password !== config.dashboardPassword)
        throw createError({ statusCode: 401, message: 'Invalid password' });

    if (!db || typeof db !== 'string')
        throw createError({ statusCode: 400, message: 'Database name required' });

    const token = await createSessionToken(db);
    setSessionCookie(event, token);
    return { ok: true };
});
