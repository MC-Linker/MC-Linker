import path from 'node:path';
import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import { verifySession } from '../../utils/auth';
import { getLogsDir, listLogFiles, normalizeLevels, streamNewLogLines, validateLogFilename, } from '../../utils/logs';

const STREAM_HEARTBEAT_MS = 10000;

export default defineEventHandler(async event => {
    await verifySession(event);

    const query = getQuery(event);
    const requestedFile = typeof query.file === 'string' && query.file ? validateLogFilename(query.file) : null;

    const filter = {
        levels: normalizeLevels(typeof query.level === 'string' ? query.level : undefined),
        feature: typeof query.feature === 'string' ? query.feature : undefined,
        guildId: typeof query.guildId === 'string' ? query.guildId : undefined,
        userId: typeof query.userId === 'string' ? query.userId : undefined,
        shardId: typeof query.shardId === 'string' ? query.shardId : undefined,
        search: typeof query.search === 'string' ? query.search : undefined,
    };

    const logsDir = getLogsDir();
    const files = await listLogFiles(logsDir);
    if (files.length === 0 && !requestedFile) {
        throw createError({ statusCode: 404, message: 'No log files found' });
    }

    let currentFile = requestedFile ?? files[0]?.file ?? null;
    if (!currentFile) {
        throw createError({ statusCode: 404, message: 'No log files found' });
    }

    setHeader(event, 'Content-Type', 'text/event-stream');
    setHeader(event, 'Cache-Control', 'no-cache, no-transform');
    setHeader(event, 'Connection', 'keep-alive');
    setHeader(event, 'X-Accel-Buffering', 'no');

    const res = event.node.res;
    res.flushHeaders?.();

    let closed = false;
    const cleanupCallbacks: Array<() => void> = [];

    function send(name: string, data: unknown) {
        if (closed) return;
        res.write(`event: ${name}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        (res as any).flush?.();
    }

    function getCurrentPath() {
        if (!currentFile) return null;
        return path.join(logsDir, currentFile);
    }

    let currentPath = getCurrentPath();
    let offset = 0;

    if (currentPath) {
        const fileStat = await stat(currentPath).catch(() => null);
        offset = fileStat?.size ?? 0;
        send('meta', { file: currentFile, offset });
    }

    async function pollFile() {
        if (!currentPath || closed) return;
        offset = await streamNewLogLines(
            currentPath,
            offset,
            entry => send('log', { file: currentFile, entry }),
            filter,
        );
    }

    async function refreshLatestFile() {
        const latestFiles = await listLogFiles(logsDir);
        if (latestFiles.length === 0) return;
        const latest = latestFiles[0].file;
        if (requestedFile || latest === currentFile) return;

        currentFile = latest;
        currentPath = getCurrentPath();
        offset = 0;
        send('meta', { file: currentFile, rotated: true });
    }

    const fileTimer = setInterval(async () => {
        await refreshLatestFile();
        await pollFile();
    }, 1000);

    const heartbeat = setInterval(() => {
        send('heartbeat', { now: Date.now() });
    }, STREAM_HEARTBEAT_MS);

    cleanupCallbacks.push(() => clearInterval(fileTimer));
    cleanupCallbacks.push(() => clearInterval(heartbeat));

    const dirWatcher = watch(logsDir, async () => {
        await refreshLatestFile();
    });
    cleanupCallbacks.push(() => dirWatcher.close());

    const closeStream = () => {
        if (closed) return;
        closed = true;
        for (const cb of cleanupCallbacks) cb();
        res.end();
    };

    event.node.req.on('close', closeStream);
    event.node.req.on('error', closeStream);

    await pollFile();

    return new Promise<void>(resolve => {
        event.node.req.on('close', () => resolve());
    });
});
