import { listAnalyticsDatabases } from '../utils/db';

export default defineEventHandler(async () => {
    const databases = await listAnalyticsDatabases();
    return { databases };
});
