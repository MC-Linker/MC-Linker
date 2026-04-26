import path from 'node:path';
import { stat } from 'node:fs/promises';
import { verifySession } from '../../utils/auth';
import {
    getLogsDir,
    normalizeLevels,
    readLogFileBackward,
    readLogFileForward,
    validateLogFilename,
} from '../../utils/logs';

export default defineEventHandler(async event => {
    await verifySession(event);

    const query = getQuery(event);
    const file = validateLogFilename(String(query.file || ''));
    const direction = String(query.direction || 'backward').toLowerCase() === 'forward' ? 'forward' : 'backward';
    const limit = Math.min(Math.max(Number(query.limit ?? 200) || 200, 1), 1000);

    const filter = {
        levels: normalizeLevels(typeof query.level === 'string' ? query.level : undefined),
        feature: typeof query.feature === 'string' ? query.feature : undefined,
        guildId: typeof query.guildId === 'string' ? query.guildId : undefined,
        userId: typeof query.userId === 'string' ? query.userId : undefined,
        shardId: typeof query.shardId === 'string' ? query.shardId : undefined,
        search: typeof query.search === 'string' ? query.search : undefined,
    };

    const logsDir = getLogsDir();
    const fullPath = path.join(logsDir, file);

    const fileStat = await stat(fullPath).catch(() => null);
    if (!fileStat?.isFile()) {
        throw createError({ statusCode: 404, message: 'Log file not found' });
    }

    const result = direction === 'forward'
        ? await readLogFileForward(fullPath, limit, filter)
        : await readLogFileBackward(fullPath, limit, filter);

    return {
        file,
        direction,
        limit,
        totalSize: fileStat.size,
        hasMore: result.hasMore,
        lines: result.lines,
    };
});
