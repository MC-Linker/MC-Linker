import { jwtVerify, SignJWT } from 'jose';
import type { H3Event } from 'h3';

const COOKIE_NAME = 'session';
const EXPIRY = '7d';

function getSecret(): Uint8Array {
    const config = useRuntimeConfig();
    return new TextEncoder().encode(config.sessionSecret);
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
        sameSite: 'strict',
        // Not httpOnly so Nuxt's useCookie() can read it client-side for the auth middleware.
        // The JWT is signed (HS256) so it cannot be forged; it contains only the db name.
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}

export function clearSessionCookie(event: H3Event): void {
    deleteCookie(event, COOKIE_NAME);
}
