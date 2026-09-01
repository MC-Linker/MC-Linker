import { jwtVerify, SignJWT } from 'jose';
import type { H3Event } from 'h3';

const COOKIE_NAME = 'session';
const EXPIRY = '7d';

function getSecret(): Uint8Array {
    const config = useRuntimeConfig();
    if (!config.sessionSecret) throw new Error('NUXT_SESSION_SECRET must be set');
    return new TextEncoder().encode(config.sessionSecret);
}

// Follows the request protocol, never NODE_ENV — Nitro inlines that as "production" at build time,
// so plain-HTTP deployments would set Secure and browsers would silently drop the session.
function useSecureCookie(event: H3Event): boolean {
    return getRequestProtocol(event) === 'https';
}

export async function createSessionToken(db: string): Promise<string> {
    return new SignJWT({ db })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(EXPIRY)
        .sign(getSecret());
}

export async function verifySession(event: H3Event): Promise<{ db: string }> {
    const token = getCookie(event, COOKIE_NAME);
    if (!token) throw createError({ statusCode: 401, message: 'Unauthorized' });

    try {
        const { payload } = await jwtVerify(token, getSecret());
        return { db: payload.db as string };
    }
    catch {
        throw createError({ status: 401, message: 'Unauthorized' });
    }
}

export function setSessionCookie(event: H3Event, token: string): void {
    setCookie(event, COOKIE_NAME, token, {
        // 'lax' so an external link into the dashboard still sends the session; POST/DELETE stay protected
        sameSite: 'lax',
        secure: useSecureCookie(event),
        // Not httpOnly so Nuxt's useCookie() can read it client-side for the auth middleware.
        // The JWT is signed (HS256) so it cannot be forged; it contains only the db name.
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}

export function clearSessionCookie(event: H3Event): void {
    // Attributes must match setSessionCookie() or the browser keeps the cookie
    deleteCookie(event, COOKIE_NAME, {
        sameSite: 'lax',
        secure: useSecureCookie(event),
        path: '/',
    });
}
