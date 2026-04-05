import os from 'node:os';
import rootLogger from '../../utilities/logger/logger.js';
import features from '../../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.analytics.aggregator });

/**
 * Shard-0-only aggregator that collects counters from all shards via broadcastEval
 * and writes periodic AnalyticsSnapshot documents to MongoDB.
 * Started from the AllShardsReady event.
 * Configuration is read from client.config.analytics (config.json).
 */
export default class AnalyticsAggregator {

    /**
     * @param {MCLinker} client
     */
    constructor(client) {
        /** @type {MCLinker} */
        this.client = client;

        /** @type {?NodeJS.Timeout} */
        this._snapshotTimer = null;

        /** @type {?os.CpuInfo[]} Previous CPU sample for delta calculation */
        this._prevCpus = os.cpus();
    }

    /**
     * Takes an initial snapshot and starts the snapshot timer.
     */
    async start() {
        logger.info('Analytics aggregator starting');
        await this._takeSnapshot();
        const { snapshotIntervalMs } = this.client.config.analytics;
        this._snapshotTimer = setInterval(() => this._takeSnapshot(), snapshotIntervalMs);
        this._snapshotTimer.unref();
    }

    /**
     * Collects metrics from all shards and writes a snapshot to MongoDB.
     */
    async _takeSnapshot() {
        try {
            const shardData = await this.client.broadcastEval(c => {
                const counters = c.analytics.getCounters();
                return {
                    shardId: c.shard.ids[0],
                    guilds: c.guilds.cache.size,
                    ping: c.ws.ping,
                    uptime: c.uptime,
                    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    cpuPercent: c.analytics.getCpuPercent(),
                    approximateUsers: c.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0),
                    serverConnections: c.serverConnections.cache.size,
                    userConnections: c.userConnections.cache.size,
                    counters,
                };
            });

            // Count online servers (shard 0 only — WebSocket sockets only exist here)
            const onlineServers = this.client.serverConnections.cache
                .filter(s => s.protocol?.socket != null)
                .size;

            // Aggregate across shards
            const totalGuilds = shardData.reduce((sum, s) => sum + s.guilds, 0);
            const approximateUsers = shardData.reduce((sum, s) => sum + s.approximateUsers, 0);
            const totalServerConnections = shardData.reduce((sum, s) => sum + s.serverConnections, 0);
            const totalUserConnections = shardData.reduce((sum, s) => sum + s.userConnections, 0);

            // Machine-level metrics (OS-wide, not just Node processes)
            const curCpus = os.cpus();
            let totalIdle = 0, totalTick = 0;
            for(let i = 0; i < curCpus.length; i++) {
                const prev = this._prevCpus[i]?.times ?? { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
                const cur = curCpus[i].times;
                const idle = cur.idle - prev.idle;
                const tick = (cur.user - prev.user) + (cur.nice - prev.nice) + (cur.sys - prev.sys) + (cur.idle - prev.idle) + (cur.irq - prev.irq);
                totalIdle += idle;
                totalTick += tick;
            }
            this._prevCpus = curCpus;
            const machineCpuPercent = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10 : 0;
            const memoryTotalMB = Math.round(os.totalmem() / 1024 / 1024);
            const memoryUsedMB = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024);

            // Merge command counters from all shards
            const mergedCommands = {};
            const mergedComponents = {};
            const mergedRestCalls = {};
            const mergedWsCalls = {};
            let totalGuildsJoined = 0;
            let totalGuildsLeft = 0;

            for(const shard of shardData) {
                const { counters } = shard;

                for(const [name, data] of Object.entries(counters.commands)) {
                    const entry = mergedCommands[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
                    entry.count += data.count;
                    entry.errors += data.errors;
                    entry.totalDurationMs += data.totalDurationMs;
                }

                for(const [name, data] of Object.entries(counters.components)) {
                    const entry = mergedComponents[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
                    entry.count += data.count;
                    entry.errors += data.errors;
                    entry.totalDurationMs += data.totalDurationMs;
                }

                for(const [name, data] of Object.entries(counters.apiCalls.rest)) {
                    const entry = mergedRestCalls[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
                    entry.count += data.count;
                    entry.errors += data.errors;
                    entry.totalDurationMs += data.totalDurationMs;
                }

                for(const [name, data] of Object.entries(counters.apiCalls.ws)) {
                    const entry = mergedWsCalls[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
                    entry.count += data.count;
                    entry.errors += data.errors;
                    entry.totalDurationMs += data.totalDurationMs;
                }

                totalGuildsJoined += counters.guildsJoined;
                totalGuildsLeft += counters.guildsLeft;
            }

            // Build snapshot document
            const now = new Date();
            const bucketKey = now.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"

            const snapshot = {
                _id: bucketKey,
                timestamp: now,
                period: 'hourly',
                guilds: {
                    total: totalGuilds,
                    joined: totalGuildsJoined,
                    left: totalGuildsLeft,
                },
                users: {
                    approximate: approximateUsers,
                },
                shards: shardData.map(s => ({
                    id: s.shardId,
                    guilds: s.guilds,
                    ping: s.ping,
                    uptime: s.uptime,
                    memoryMB: s.memoryMB,
                    cpuPercent: s.cpuPercent,
                })),
                commands: Object.entries(mergedCommands).map(([name, data]) => ({
                    name,
                    count: data.count,
                    errors: data.errors,
                    avgDurationMs: data.count > 0 ? Math.round(data.totalDurationMs / data.count) : 0,
                })),
                components: Object.entries(mergedComponents).map(([name, data]) => ({
                    name,
                    count: data.count,
                    errors: data.errors,
                    avgDurationMs: data.count > 0 ? Math.round(data.totalDurationMs / data.count) : 0,
                })),
                apiCalls: {
                    rest: Object.entries(mergedRestCalls).map(([name, data]) => ({
                        name,
                        count: data.count,
                        avgDurationMs: data.count > 0 ? Math.round(data.totalDurationMs / data.count) : 0,
                    })),
                    ws: Object.entries(mergedWsCalls).map(([name, data]) => ({
                        name,
                        count: data.count,
                        errors: data.errors,
                        avgDurationMs: data.count > 0 ? Math.round(data.totalDurationMs / data.count) : 0,
                    })),
                },
                machine: {
                    cpuPercent: machineCpuPercent,
                    memoryUsedMB,
                    memoryTotalMB,
                },
                connections: {
                    servers: totalServerConnections,
                    users: totalUserConnections,
                    online: onlineServers,
                },
            };

            await this.client.mongo.models.AnalyticsSnapshot.updateOne(
                { _id: bucketKey },
                snapshot,
                { upsert: true },
            );

            // Reset counters on all shards
            await this.client.broadcastEval(c => c.analytics.resetCounters());

            logger.info(`Analytics snapshot saved: ${bucketKey} (${totalGuilds} guilds, ${Object.keys(mergedCommands).length} commands tracked)`);
        }
        catch(err) {
            logger.error(err, 'Failed to take analytics snapshot');
        }
    }

    /**
     * Stops the aggregator and clears the timer.
     */
    destroy() {
        if(this._snapshotTimer) {
            clearInterval(this._snapshotTimer);
            this._snapshotTimer = null;
        }
    }
}
