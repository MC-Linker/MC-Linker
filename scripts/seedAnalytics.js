#!/usr/bin/env node
/**
 * Seeds example analytics data into MongoDB for dashboard development/testing.
 * Usage: node scripts/seedAnalytics.js [--db <name>] [--host <host>] [--days <n>]
 */
import mongoose from 'mongoose';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
    .option('host', { type: 'string', default: 'localhost:27017', description: 'MongoDB host:port' })
    .option('db', { type: 'string', default: 'dev-mc-linker', description: 'Database name' })
    .option('days', { type: 'number', default: 14, description: 'Days of history to generate' })
    .option('shards', { type: 'number', default: 4, description: 'Number of shards to simulate' })
    .help().argv;

const uri = `mongodb://${argv.host}/${argv.db}`;

// ── Schemas ───────────────────────────────────────────────────────────────────

const snapshotSchema = new mongoose.Schema({
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
        cpuPercent: Number,
    }],
    commands: [{ _id: false, name: String, count: Number, errors: Number, avgDurationMs: Number }],
    components: [{ _id: false, name: String, count: Number, errors: Number, avgDurationMs: Number }],
    apiCalls: {
        rest: [{ _id: false, name: String, count: Number, avgDurationMs: Number }],
        ws: [{ _id: false, name: String, count: Number, errors: Number, avgDurationMs: Number }],
    },
    machine: { cpuPercent: Number, memoryUsedMB: Number, memoryTotalMB: Number },
    connections: { servers: Number, users: Number, online: Number },
});

const errorSchema = new mongoose.Schema({
    timestamp: Date,
    type: String,
    name: String,
    guildId: String,
    userId: String,
    shardId: Number,
    error: { message: String, stack: String, code: String },
    context: { type: Map, of: String },
});

const serverConnectionSchema = new mongoose.Schema({ _id: String }, { strict: false });


// ── Sample data pools ─────────────────────────────────────────────────────────

const COMMANDS = [
    { name: 'link', baseCount: 320, baseDuration: 210, errorRate: 0.04 },
    { name: 'unlink', baseCount: 85, baseDuration: 180, errorRate: 0.02 },
    { name: 'settings', baseCount: 540, baseDuration: 95, errorRate: 0.01 },
    { name: 'whitelist', baseCount: 210, baseDuration: 130, errorRate: 0.03 },
    { name: 'chat', baseCount: 1800, baseDuration: 55, errorRate: 0.005 },
    { name: 'tp', baseCount: 430, baseDuration: 170, errorRate: 0.06 },
    { name: 'inventory', baseCount: 290, baseDuration: 145, errorRate: 0.02 },
    { name: 'status', baseCount: 670, baseDuration: 80, errorRate: 0.01 },
    { name: 'setup', baseCount: 42, baseDuration: 300, errorRate: 0.08 },
    { name: 'reload', baseCount: 15, baseDuration: 250, errorRate: 0.05 },
];

const COMPONENTS = [
    { name: 'confirm_button', baseCount: 390, baseDuration: 45, errorRate: 0.01 },
    { name: 'cancel_button', baseCount: 150, baseDuration: 40, errorRate: 0.005 },
    { name: 'settings_select', baseCount: 280, baseDuration: 90, errorRate: 0.02 },
    { name: 'page_next', baseCount: 560, baseDuration: 35, errorRate: 0.005 },
    { name: 'page_prev', baseCount: 310, baseDuration: 35, errorRate: 0.005 },
    { name: 'server_select', baseCount: 195, baseDuration: 60, errorRate: 0.03 },
];

const REST_CALLS = [
    { name: 'GET /guilds/:id', baseCount: 1200, baseDuration: 45 },
    { name: 'GET /channels/:id', baseCount: 980, baseDuration: 38 },
    { name: 'POST /channels/:id/messages', baseCount: 620, baseDuration: 85 },
    { name: 'GET /users/:id', baseCount: 440, baseDuration: 32 },
    { name: 'GET /guilds/:id/members', baseCount: 310, baseDuration: 65 },
];

const WS_EVENTS = [
    { name: 'chat', baseCount: 1750, baseDuration: 12, errorRate: 0.005 },
    { name: 'command', baseCount: 850, baseDuration: 18, errorRate: 0.01 },
    { name: 'status', baseCount: 480, baseDuration: 8, errorRate: 0.002 },
    { name: 'disconnect', baseCount: 230, baseDuration: 6, errorRate: 0.001 },
];

const GUILD_IDS = Array.from({ length: 20 }, (_, i) => String(800000000000000000n + BigInt(i) * 1000000n));
const USER_IDS = Array.from({ length: 10 }, (_, i) => String(700000000000000000n + BigInt(i) * 1000000n));

const CHAT_TYPES = ['chat', 'console', 'join', 'quit', 'advancement', 'death', 'player_command'];
const ROLE_DIRECTIONS = ['both', 'to_minecraft', 'to_discord'];

function buildServerConnections(guildIds) {
    return guildIds.map(id => {
        const hasChatChannels = Math.random() < 0.75;
        const hasStatChannels = Math.random() < 0.50;
        const hasSyncedRoles = Math.random() < 0.35;
        const hasRequiredRole = Math.random() < 0.20;
        const hasRequiredLinked = !hasRequiredRole && Math.random() < 0.15;
        const hasFloodgate = Math.random() < 0.15;

        const chatChannels = hasChatChannels ? Array.from({ length: rand(1, 3) }, (_, i) => {
            const types = CHAT_TYPES.slice(0, rand(1, CHAT_TYPES.length));
            return {
                _id: String(500000000000000000n + BigInt(id) + BigInt(i)),
                types,
                allowDiscordToMinecraft: Math.random() < 0.70,
                webhooks: Array.from({ length: rand(1, 2) }, () =>
                    String(400000000000000000n + BigInt(rand(0, 999999)))),
            };
        }) : [];

        const statChannels = hasStatChannels ? Array.from({ length: rand(1, 2) }, (_, i) => ({
            _id: String(600000000000000000n + BigInt(id) + BigInt(i)),
            type: Math.random() < 0.6 ? 'member-counter' : 'status',
            names: { online: '🟢 Online: {count}', offline: '🔴 Offline', members: '👥 Members: {count}' },
        })) : [];

        const syncedRoles = hasSyncedRoles ? Array.from({ length: rand(1, 3) }, (_, i) => ({
            _id: String(300000000000000000n + BigInt(id) + BigInt(i)),
            name: pick(['admin', 'moderator', 'vip', 'member', 'builder']) + `_${i}`,
            isGroup: Math.random() < 0.5,
            players: [],
            direction: pick(ROLE_DIRECTIONS),
        })) : [];

        return {
            _id: id,
            ip: `server${id.slice(-4)}.example.com`,
            version: pick([759, 760, 761, 762, 763, 765]),
            online: Math.random() < 0.8,
            forceOnlineMode: Math.random() < 0.6,
            floodgatePrefix: hasFloodgate ? '.' : undefined,
            requiredRoleToJoin: hasRequiredRole ? {
                method: Math.random() < 0.5 ? 'all' : 'any',
                roles: [String(200000000000000000n + BigInt(id))],
            } : hasRequiredLinked ? {
                method: 'all',
                roles: [],
                requireLinked: true,
            } : { method: 'all', roles: [] },
            chatChannels,
            statChannels,
            syncedRoles,
        };
    });
}

const MONITOR_OPS = ['avatarURL', 'guilds.fetch', 'channels.fetch', 'parseMentions', 'selectWebhook', 'resolve', 'webhook.send', 'webhook.editMessage'];
const RL_CATEGORIES = ['webhook.send', 'createWebhook', 'deleteWebhook', 'fetchWebhook', 'channels.fetch', 'scaleUp'];

const ERROR_MESSAGES = {
    command: ['Missing permissions', 'Unknown interaction', 'Server not linked', 'Rate limited'],
    component: ['Interaction expired', 'Unknown component', 'Missing permissions'],
    api_ws: ['Connection refused', 'Timeout', 'Invalid token'],
    api_rest: ['429 Too Many Requests', '403 Forbidden', '500 Internal Server Error'],
    unhandled: ['Cannot read properties of undefined', 'ECONNREFUSED', 'MongoNetworkError'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function jitter(base, pct = 0.25) { return Math.max(1, Math.round(base * (1 + (Math.random() * 2 - 1) * pct))); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Simulate slight growth trend over time (guilds grow ~0.3% per hour on average)
function guildCount(hourIndex, totalHours, base = 9800) {
    const trend = base * (1 + 0.003 * (hourIndex / 24));
    return Math.round(trend + rand(-30, 30));
}

function buildShards(numShards, uptimeBase, hourIndex) {
    return Array.from({ length: numShards }, (_, id) => ({
        id,
        guilds: rand(2300, 2700),
        ping: rand(40, 180),
        uptime: (uptimeBase + hourIndex * 3600) * 1000,
        memoryMB: rand(180, 380),
        cpuPercent: Math.round((rand(5, 45) + Math.random() * 10) * 10) / 10,
    }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
    console.log(`Connecting to ${uri}…`);
    await mongoose.connect(uri);
    const Snapshot = mongoose.model('AnalyticsSnapshot', snapshotSchema);
    const Error_ = mongoose.model('AnalyticsError', errorSchema);
    const ServerConn = mongoose.model('ServerConnection', serverConnectionSchema, 'serverconnections');
    // Clear existing seed data
    await Snapshot.deleteMany({});
    await Error_.deleteMany({});
    await ServerConn.deleteMany({});
    console.log('Cleared existing analytics data.');

    const totalHours = argv.days * 24;
    const now = new Date();
    now.setMinutes(0, 0, 0);

    const snapshots = [];
    const errors = [];

    for(let h = 0; h < totalHours; h++) {
        const ts = new Date(now.getTime() - (totalHours - h) * 3600_000);
        const id = ts.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
        const hourOfDay = ts.getUTCHours();

        // Traffic multiplier: peak during daytime UTC hours
        const trafficMult = 0.3 + 0.7 * Math.sin(Math.max(0, Math.PI * (hourOfDay - 7) / 14));

        const commands = COMMANDS.map(c => {
            const count = jitter(Math.round(c.baseCount * trafficMult));
            const errors = Math.round(count * c.errorRate * jitter(1, 0.5));
            return { name: c.name, count, errors, avgDurationMs: jitter(c.baseDuration) };
        });

        const components = COMPONENTS.map(c => {
            const count = jitter(Math.round(c.baseCount * trafficMult));
            const errors = Math.round(count * c.errorRate * jitter(1, 0.5));
            return { name: c.name, count, errors, avgDurationMs: jitter(c.baseDuration) };
        });

        const joined = rand(0, Math.round(8 * trafficMult));
        const left = rand(0, Math.round(5 * trafficMult));
        const total = guildCount(h, totalHours);

        const shards = buildShards(argv.shards, 86400 * 3, h);
        const machineCpuPercent = Math.round((rand(10, 65) + Math.random() * 15) * 10) / 10;
        const memoryTotalMB = 8192;
        const memoryUsedMB = rand(3200, 6800);

        snapshots.push({
            _id: id,
            timestamp: ts,
            period: 'hourly',
            guilds: { total, joined, left },
            users: { approximate: total * rand(28, 35) },
            shards,
            commands,
            components,
            apiCalls: {
                rest: REST_CALLS.map(r => ({
                    name: r.name,
                    count: jitter(Math.round(r.baseCount * trafficMult)),
                    avgDurationMs: jitter(r.baseDuration),
                })),
                ws: WS_EVENTS.map(w => ({
                    name: w.name,
                    count: jitter(Math.round(w.baseCount * trafficMult)),
                    errors: Math.round(w.baseCount * w.errorRate),
                    avgDurationMs: jitter(w.baseDuration),
                })),
            },
            machine: { cpuPercent: machineCpuPercent, memoryUsedMB, memoryTotalMB },
            connections: {
                servers: rand(180, 260),
                users: rand(420, 680),
                online: rand(150, 220),
            },
            chatMonitor: (() => {
                const incoming = jitter(Math.round(1680 * trafficMult)); // ~28/min * 60
                const enqueued = Math.round(incoming * (0.85 + Math.random() * 0.12));
                const processed = Math.round(enqueued * (0.90 + Math.random() * 0.10));

                const rlMap = new Map();
                if(Math.random() < 0.25 * trafficMult) {
                    const cat = pick(RL_CATEGORIES);
                    rlMap.set(cat, rand(1, 15));
                    if(Math.random() < 0.3) rlMap.set(pick(RL_CATEGORIES), rand(1, 8));
                }

                return {
                    throughput: { incoming, enqueued, processed },
                    queue: {
                        destinations: rand(2, Math.round(12 * trafficMult) + 2),
                        items: rand(0, Math.round(30 * trafficMult)),
                    },
                    rateLimits: [...rlMap.entries()].map(([category, count]) => ({ category, count })),
                    failures: {
                        permission: Math.random() < 0.15 ? rand(1, 5) : 0,
                        creation: Math.random() < 0.08 ? rand(1, 3) : 0,
                    },
                    operations: MONITOR_OPS.map(name => ({
                        name,
                        count: jitter(Math.round((name === 'webhook.send' ? 1200 : name === 'guilds.fetch' ? 900 : 480) * trafficMult)),
                        rateLimits: Math.random() < 0.05 ? rand(1, 4) : 0,
                    })),
                };
            })(),
        });

        // Generate ~2-6 errors per hour
        const errCount = rand(1, 6);
        for(let e = 0; e < errCount; e++) {
            const type = pick(['command', 'component', 'api_ws', 'unhandled']);
            const name = type === 'command' ? pick(COMMANDS).name
                : type === 'component' ? pick(COMPONENTS).name
                    : type === 'api_ws' ? pick(WS_EVENTS).name
                        : undefined;
            const msg = pick(ERROR_MESSAGES[type]);
            errors.push({
                timestamp: new Date(ts.getTime() + rand(0, 3599) * 1000),
                type,
                name,
                guildId: pick(GUILD_IDS),
                userId: pick(USER_IDS),
                shardId: rand(0, argv.shards - 1),
                error: {
                    message: msg,
                    stack: `Error: ${msg}\n    at handler (/app/events/${type}.js:42:12)\n    at processEvents (/app/bot.js:120:8)`,
                    code: type === 'api_ws' ? String(rand(1000, 5000)) : undefined,
                },
                context: new Map([['command', name ?? type], ['guildId', pick(GUILD_IDS)]]),
            });
        }
    }

    const serverConnections = buildServerConnections(GUILD_IDS);

    await Snapshot.insertMany(snapshots, { ordered: false });
    await Error_.insertMany(errors, { ordered: false });
    await ServerConn.insertMany(serverConnections, { ordered: false });

    console.log(`Seeded ${snapshots.length} snapshots, ${errors.length} errors, and ${serverConnections.length} server connections into "${argv.db}".`);
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
