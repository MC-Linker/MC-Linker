import { verifySession } from '../../utils/auth';

export default defineEventHandler(async event => {
    const { db } = await verifySession(event);
    return { db };
});
