import mongoose from 'mongoose';

const connections = new Map<string, mongoose.Connection>();

/**
 * Parses `from` and `to` query parameters into Date objects with validation.
 * `to` is set to end-of-day (23:59:59.999) when only a date string is given.
 */
export function parseDateRange(query: Record<string, unknown>): { from: Date; to: Date } {
    const fromStr = query.from as string | undefined;
    const toStr = query.to as string | undefined;

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (isNaN(from.getTime())) throw createError({ status: 400, message: 'Invalid "from" date' });

    let to: Date;
    if (toStr) {
        // Only append time suffix if the string looks like a plain date (no 'T')
        to = new Date(toStr.includes('T') ? toStr : toStr + 'T23:59:59.999Z');
    }
    else {
        to = new Date();
    }
    if (isNaN(to.getTime())) throw createError({ status: 400, message: 'Invalid "to" date' });

    return { from, to };
}

/**
 * Parses a numeric query parameter with a default and max value.
 */
export function parseIntParam(value: unknown, defaultValue: number, max?: number): number {
    const num = Number(value ?? defaultValue);
    const result = isNaN(num) ? defaultValue : Math.max(1, Math.floor(num));
    return max !== undefined ? Math.min(result, max) : result;
}

const analyticsSnapshotSchema = new mongoose.Schema({
    _id: String,
    timestamp: Date,
    period: String,
    guilds: { total: Number, joined: Number, left: Number },
    users: { approximate: Number },
    shards: [{
        _id: false,
        id: Number,
        guilds: Number,
        ping: Number,
        uptime: Number,
        memoryMB: Number,
        cpuPercent: Number
    }],
    commands: [{ _id: false, name: String, count: Number, errors: Number, avgDurationMs: Number }],
    components: [{ _id: false, name: String, count: Number, errors: Number, avgDurationMs: Number }],
    apiCalls: {
        rest: [{ _id: false, name: String, count: Number, avgDurationMs: Number }],
        ws: [{ _id: false, name: String, count: Number, errors: Number, avgDurationMs: Number }],
    },
    machine: { cpuPercent: Number, memoryUsedMB: Number, memoryTotalMB: Number },
    connections: { servers: Number, users: Number, online: Number },
    chatMonitor: {
        throughput: { incoming: Number, enqueued: Number, processed: Number },
        queue: { destinations: Number, items: Number },
        rateLimits: { type: Map, of: Number },
        failures: { permission: Number, creation: Number },
        operations: [{ _id: false, name: String, count: Number, rateLimits: Number }],
    },
});

const serverConnectionSchema = new mongoose.Schema({
    _id: String,
    ip: String,
    version: Number,
    path: String,
    worldPath: String,
    online: Boolean,
    forceOnlineMode: Boolean,
    floodgatePrefix: String,
    requiredRoleToJoin: { method: { type: String, enum: ['all', 'any'] }, roles: [String] },
    displayIp: String,
    port: Number,
    chatChannels: [{
        _id: String,
        types: [String],
        allowDiscordToMinecraft: Boolean,
        webhooks: [String],
    }],
    statChannels: [{
        _id: String,
        type: { type: String, enum: ['member-counter', 'status'] },
        names: { online: String, offline: String, members: String },
    }],
    syncedRoles: [{
        _id: String,
        name: String,
        isGroup: Boolean,
        players: [String],
        direction: { type: String, enum: ['both', 'to_minecraft', 'to_discord'], default: 'both' },
    }],
}, { strict: false });

const analyticsErrorSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    type: String,
    name: String,
    guildId: String,
    userId: String,
    shardId: Number,
    error: { message: String, stack: String, code: String },
    context: { type: Map, of: String },
});

/**
 * Returns a cached mongoose Connection for the given database name.
 * Creates a new connection on first access.
 */
export function getConnection(dbName: string): mongoose.Connection {
    if (connections.has(dbName)) return connections.get(dbName)!;

    if (!/^[a-zA-Z0-9_-]+$/.test(dbName))
        throw new Error(`Invalid database name: ${dbName}`);

    const config = useRuntimeConfig();
    const uri = `${config.databaseUrl}/${dbName}`;
    const conn = mongoose.createConnection(uri);

    conn.on('error', (err: Error) => {
        console.error(`MongoDB connection error for ${dbName}:`, err.message);
        connections.delete(dbName);
    });

    conn.model('AnalyticsSnapshot', analyticsSnapshotSchema);
    conn.model('AnalyticsError', analyticsErrorSchema);
    conn.model('ServerConnection', serverConnectionSchema, 'serverconnections');

    connections.set(dbName, conn);
    return conn;
}

/**
 * Lists all non-system database names that contain the analyticsnapshots collection.
 */
export async function listAnalyticsDatabases(): Promise<string[]> {
    const config = useRuntimeConfig();

    // Use a temporary admin connection to list databases
    const adminConn = mongoose.createConnection(config.databaseUrl);
    let databases: { name: string }[];
    try {
        await adminConn.asPromise();
        const adminDb = adminConn.db!.admin();
        ({ databases } = await adminDb.listDatabases());
    }
    finally {
        await adminConn.close();
    }

    const systemDbs = new Set(['admin', 'config', 'local']);
    const names = databases
        .map((d: { name: string }) => d.name)
        .filter((name: string) => !systemDbs.has(name));

    // Filter to only DBs that actually have analytics data
    const results: string[] = [];
    for (const name of names) {
        const conn = getConnection(name);
        await conn.asPromise();
        const collections = await conn.db!.listCollections({ name: 'analyticssnapshots' }).toArray();
        if (collections.length > 0) results.push(name);
        else {
            connections.delete(name);
            await conn.close();
        }
    }

    return results;
}
