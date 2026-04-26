import { verifySession } from '../../utils/auth';
import { getLogsDir, listLogFiles } from '../../utils/logs';

export default defineEventHandler(async event => {
    await verifySession(event);
    const logsDir = getLogsDir();
    const files = await listLogFiles(logsDir);

    return {
        files,
    };
});
