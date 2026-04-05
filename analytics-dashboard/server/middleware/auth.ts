import { verifySession } from '../utils/auth';

const PUBLIC_PREFIXES = ['/api/', '/_nuxt/', '/__nuxt', '/login', '/favicon'];

export default defineEventHandler(async event => {
    const url = getRequestURL(event);
    if (PUBLIC_PREFIXES.some(p => url.pathname.startsWith(p))) return;

    try {
        await verifySession(event);
    }
    catch {
        await sendRedirect(event, '/login', 302);
    }
});
