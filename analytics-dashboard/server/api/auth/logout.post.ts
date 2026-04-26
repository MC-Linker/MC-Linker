import { clearSessionCookie } from '../../utils/auth';

export default defineEventHandler(event => {
    clearSessionCookie(event);
    return { ok: true };
});
