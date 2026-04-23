import { createReadStream } from 'node:fs';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface LogEntry {
    timestamp?: string;
    level?: number | string;
    msg?: string;
    message?: string;
    feature?: string;
    guildId?: string;
    userId?: string;
    shardId?: number;

    [key: string]: unknown;
}

export interface LogFilter {
    levels?: string[];
    feature?: string;
    guildId?: string;
    userId?: string;
    shardId?: string;
    search?: string;
}

export const LOG_FILE_REGEX = /^\d{4}-\d{2}-\d{2}(?:-\d+)?\.log$/;

const LEVEL_TO_NAME = new Map<number, string>([
    [10, 'trace'],
    [20, 'debug'],
    [30, 'info'],
    [40, 'warn'],
    [50, 'error'],
    [60, 'fatal'],
]);

export function getLogsDir(): string {
    const config = useRuntimeConfig();
    return path.resolve(config.logsDir || './logs');
}

export function normalizeLevels(raw?: string): string[] | undefined {
    if (!raw) return undefined;
    const levels = raw
        .split(',')
        .map(level => level.trim().toLowerCase())
        .filter(Boolean);

    return levels.length > 0 ? levels : undefined;
}

export function normalizeLogLevel(level: number | string | undefined): string | null {
    if (typeof level === 'number') {
        return LEVEL_TO_NAME.get(level) ?? String(level);
    }
    if (typeof level === 'string') {
        return level.toLowerCase();
    }
    return null;
}

export function parseLogLine(line: string): LogEntry | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    try {
        return JSON.parse(trimmed) as LogEntry;
    }
    catch {
        return null;
    }
}

export function getLogMessage(entry: LogEntry): string {
    const message = entry.msg ?? entry.message;
    return typeof message === 'string' ? message : '';
}

export function filterLogEntry(entry: LogEntry, filter: LogFilter): boolean {
    const levelName = normalizeLogLevel(entry.level);

    if (filter.levels && filter.levels.length > 0) {
        if (!levelName || !filter.levels.includes(levelName)) return false;
    }

    if (filter.feature) {
        const feature = typeof entry.feature === 'string' ? entry.feature : '';
        if (!feature || feature !== filter.feature && !feature.startsWith(`${filter.feature}.`)) return false;
    }

    if (filter.guildId) {
        if (String(entry.guildId ?? '') !== filter.guildId) return false;
    }

    if (filter.userId) {
        if (String(entry.userId ?? '') !== filter.userId) return false;
    }

    if (filter.shardId) {
        if (String(entry.shardId ?? '') !== filter.shardId) return false;
    }

    if (filter.search) {
        const search = filter.search.toLowerCase();
        const msg = getLogMessage(entry).toLowerCase();
        const serialized = JSON.stringify(entry).toLowerCase();
        if (!msg.includes(search) && !serialized.includes(search)) return false;
    }

    return true;
}

export async function listLogFiles(logsDir: string): Promise<Array<{ file: string, size: number, mtime: string }>> {
    const names = await readdir(logsDir).catch(() => [] as string[]);
    const files = names.filter(name => LOG_FILE_REGEX.test(name));
    const result: Array<{ file: string, size: number, mtime: string }> = [];

    for (const file of files) {
        const fullPath = path.join(logsDir, file);
        const fileStat = await stat(fullPath).catch(() => null);
        if (!fileStat?.isFile()) continue;
        result.push({
            file,
            size: fileStat.size,
            mtime: fileStat.mtime.toISOString(),
        });
    }

    result.sort((a, b) => {
        if (a.file < b.file) return 1;
        if (a.file > b.file) return -1;
        return 0;
    });

    return result;
}

export function validateLogFilename(file: string): string {
    if (!LOG_FILE_REGEX.test(file)) {
        throw createError({ statusCode: 400, message: 'Invalid log file name' });
    }
    return file;
}

export async function readLogFileForward(
    fullPath: string,
    limit: number,
    filter: LogFilter,
): Promise<{ lines: LogEntry[], hasMore: boolean }> {
    const content = await readFile(fullPath, 'utf8').catch(() => '');
    const rows = content.split(/\r?\n/);
    const parsed = rows
        .map(parseLogLine)
        .filter((entry): entry is LogEntry => Boolean(entry))
        .filter(entry => filterLogEntry(entry, filter));

    return {
        lines: parsed.slice(0, limit),
        hasMore: parsed.length > limit,
    };
}

export async function readLogFileBackward(
    fullPath: string,
    limit: number,
    filter: LogFilter,
): Promise<{ lines: LogEntry[], hasMore: boolean }> {
    const fileHandle = await open(fullPath, 'r');
    try {
        const fileStat = await fileHandle.stat();
        const chunkSize = 64 * 1024;
        let position = fileStat.size;
        let tail = '';
        const matches: LogEntry[] = [];

        while (position > 0 && matches.length < limit + 1) {
            const readSize = Math.min(chunkSize, position);
            position -= readSize;
            const buffer = Buffer.alloc(readSize);
            await fileHandle.read(buffer, 0, readSize, position);

            const chunkText = buffer.toString('utf8');
            const block = `${chunkText}${tail}`;
            const lines = block.split(/\r?\n/);
            tail = lines.shift() ?? '';

            for (let i = lines.length - 1; i >= 0; i--) {
                const parsed = parseLogLine(lines[i]);
                if (!parsed) continue;
                if (!filterLogEntry(parsed, filter)) continue;
                matches.push(parsed);
                if (matches.length >= limit + 1) break;
            }
        }

        if (position === 0 && tail) {
            const parsed = parseLogLine(tail);
            if (parsed && filterLogEntry(parsed, filter)) matches.push(parsed);
        }

        return {
            lines: matches.slice(0, limit),
            hasMore: matches.length > limit,
        };
    }
    finally {
        await fileHandle.close();
    }
}

export async function streamNewLogLines(
    fullPath: string,
    fromOffset: number,
    onEntry: (entry: LogEntry) => void,
    filter: LogFilter,
): Promise<number> {
    const fileStat = await stat(fullPath).catch(() => null);
    if (!fileStat) return fromOffset;

    if (fromOffset > fileStat.size) return fileStat.size;
    if (fromOffset === fileStat.size) return fromOffset;

    const stream = createReadStream(fullPath, {
        encoding: 'utf8',
        start: fromOffset,
        end: fileStat.size - 1,
    });

    let chunk = '';
    for await (const part of stream) {
        chunk += part;
    }

    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
        const parsed = parseLogLine(line);
        if (!parsed) continue;
        if (!filterLogEntry(parsed, filter)) continue;
        onEntry(parsed);
    }

    return fileStat.size;
}
