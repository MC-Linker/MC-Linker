import rootLogger from '../../utilities/logger/logger.js';
import features from '../../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.analytics.collector });

/** @type {?AnalyticsCollector} */
let _instance = null;

/**
 * Module-level trackError — safe to call before analytics is initialized (no-op if not yet ready).
 * Use this in files that don't have direct access to the client instance.
 * @param {'command'|'component'|'api_rest'|'api_ws'|'unhandled'} type
 * @param {?string} name
 * @param {?string} guildId
 * @param {?string} userId
 * @param {Error|{message:string,stack?:string,code?:string}|null} error
 * @param {Object.<string,string>} [context]
 * @param {import('pino').Logger} [log] - Contextual logger (preserves feature/guildId bindings). Falls back to analytics logger.
 */
export function trackError(type, name, guildId, userId, error, context, log) {
    _instance?.trackError(type, name, guildId, userId, error, context, log);
}

/**
 * Per-shard analytics collector that maintains in-memory counters and buffers errors.
 * All track*() methods are synchronous and return immediately — zero impact on command latency.
 * Errors are flushed to MongoDB periodically via insertMany.
 * Counters are read by the AnalyticsAggregator on shard 0 via broadcastEval.
 * Configuration is read from client.config.analytics (config.json).
 */
export default class AnalyticsCollector {

    /**
     * @param {MCLinker} client
     */
    constructor(client) {
        /** @type {MCLinker} */
        this.client = client;
        _instance = this;

        /** @type {Object[]} */
        this._errorBuffer = [];

        this._counters = AnalyticsCollector._emptyCounters();

        const { flushIntervalMs, maxErrorBufferSize, cpuSampleIntervalMs } = client.config.analytics;
        this._maxBufferSize = maxErrorBufferSize;

        // CPU usage tracking — sample periodically, store rolling percentage
        this._lastCpuUsage = process.cpuUsage();
        this._lastCpuTime = Date.now();
        this._cpuPercent = 0;
        this._cpuTimer = setInterval(() => this._sampleCpu(), cpuSampleIntervalMs);
        this._cpuTimer.unref();

        this._flushTimer = setInterval(() => this._flush(), flushIntervalMs);
        this._flushTimer.unref();
    }

    /**
     * @returns {Object} Fresh empty counters.
     */
    static _emptyCounters() {
        return {
            commands: {},
            components: {},
            apiCalls: { rest: {}, ws: {} },
            guildsJoined: 0,
            guildsLeft: 0,
        };
    }

    /**
     * Track a slash command execution.
     * @param {string} name - Command name.
     * @param {?string} guildId
     * @param {string} userId
     * @param {number} durationMs - Execution time in milliseconds.
     * @param {boolean} success
     */
    trackCommand(name, guildId, userId, durationMs, success) {
        const entry = this._counters.commands[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
        entry.count++;
        entry.totalDurationMs += durationMs;
        if(!success) entry.errors++;
    }

    /**
     * Track a component (button/modal) interaction.
     * @param {string} name - Component customId.
     * @param {?string} guildId
     * @param {string} userId
     * @param {number} durationMs - Execution time in milliseconds.
     * @param {boolean} success
     */
    trackComponent(name, guildId, userId, durationMs, success) {
        const entry = this._counters.components[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
        entry.count++;
        entry.totalDurationMs += durationMs;
        if(!success) entry.errors++;
    }

    /**
     * Track an API call (REST or WebSocket).
     * @param {'rest'|'ws'} type
     * @param {string} name - Route endpoint or WS event name.
     * @param {?string} guildId
     * @param {number} durationMs - Execution time in milliseconds.
     * @param {boolean} [success=true]
     */
    trackApiCall(type, name, guildId, durationMs, success = true) {
        const bucket = this._counters.apiCalls[type];
        if(!bucket) return;
        const entry = bucket[name] ??= { count: 0, errors: 0, totalDurationMs: 0 };
        entry.count++;
        entry.totalDurationMs += durationMs;
        if(!success) entry.errors++;
    }

    /**
     * Track the bot joining a guild.
     * @param {string} guildId
     * @param {number} memberCount
     */
    trackGuildJoin(guildId, memberCount) {
        this._counters.guildsJoined++;
    }

    /**
     * Track the bot leaving a guild.
     * @param {string} guildId
     * @param {number} memberCount
     */
    trackGuildLeave(guildId, memberCount) {
        this._counters.guildsLeft++;
    }

    /**
     * Track an error. Pushes to the error buffer for periodic flush to MongoDB.
     * @param {'command'|'component'|'api_rest'|'api_ws'|'unhandled'} type - Error type/category.
     * @param {string} name - Command/component/route name.
     * @param {?string} guildId
     * @param {?string} userId
     * @param {Error} error
     * @param {Object.<string, string>} [context] - Optional additional context (e.g. parameters, event data) as key-value pairs.
     * @param {import('pino').Logger} [log] - Contextual logger (preserves feature/guildId bindings). Falls back to analytics logger.
     */
    trackError(type, name, guildId, userId, error, context, log) {
        (log ?? logger).error({ err: error, guildId, userId, type, name, ...context }, `[${type}] ${name ?? 'error'}`);

        this._errorBuffer.push({
            timestamp: new Date(),
            type,
            name,
            guildId: guildId ?? null,
            userId: userId ?? null,
            shardId: this.client.shard.ids[0],
            error: {
                message: error?.message ?? String(error),
                stack: error?.stack ?? null,
                code: error?.code ?? null,
            },
            context: context ?? null,
        });

        if(this._errorBuffer.length >= this._maxBufferSize) this._flush();
    }

    /**
     * Samples CPU usage since last sample and updates the rolling percentage.
     * process.cpuUsage() is per-process, so this is per-shard.
     */
    _sampleCpu() {
        const now = Date.now();
        const elapsed = (now - this._lastCpuTime) * 1000; // convert to microseconds
        const cpu = process.cpuUsage(this._lastCpuUsage);
        this._cpuPercent = Math.round(((cpu.user + cpu.system) / elapsed) * 100 * 10) / 10;
        this._lastCpuUsage = process.cpuUsage();
        this._lastCpuTime = now;
    }

    /**
     * Returns the latest CPU usage percentage for this shard.
     * @returns {number}
     */
    getCpuPercent() {
        return this._cpuPercent;
    }

    /**
     * Returns a plain-object snapshot of counters (safe for broadcastEval serialization).
     * @returns {Object}
     */
    getCounters() {
        return structuredClone(this._counters);
    }

    /**
     * Resets all counters. Called by the aggregator after taking a snapshot.
     */
    resetCounters() {
        this._counters = AnalyticsCollector._emptyCounters();
    }

    /**
     * Flushes the error buffer to MongoDB.
     */
    async _flush() {
        if(!this._errorBuffer.length) return;

        const errors = this._errorBuffer;
        this._errorBuffer = [];

        try {
            await this.client.mongo.models.AnalyticsError.insertMany(errors, { ordered: false });
            logger.debug(`Flushed ${errors.length} analytics errors to MongoDB`);
        }
        catch(err) {
            logger.error(err, `Analytics error flush failed (${errors.length} errors)`);
        }
    }

    /**
     * Performs a final flush and clears the timer.
     */
    async destroy() {
        clearInterval(this._flushTimer);
        clearInterval(this._cpuTimer);
        await this._flush();
    }
}
