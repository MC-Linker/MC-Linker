import pino from 'pino';
import path from 'path';
import fs from 'fs';

/**
 * Wraps a pino logger instance with dynamic per-call debug filtering.
 *
 * - `debug` and `trace`: gated by the active debug filter map. Each call merges the logger's
 *   static filter (set at construction via `child()`) with any structured object passed as the
 *   first argument, then checks whether any active filter matches the result. This means
 *   `enableDebug({ guildId: '123' })` will surface any `logger.debug({ guildId: '123' }, …)` call
 *   regardless of which module-level logger issued it.
 * - `info`, `warn`, `error`, `fatal`: always forwarded to pino unconditionally.
 *
 * The underlying pino instance is kept at level `'trace'` so it never filters anything our
 * wrapper has already decided to forward.
 */
class Logger {

    /**
     * @typedef {{ feature?: string, guildId?: string, userId?: string }} DebugFilter
     */

    /** @type {Map<string, DebugFilter>} - Active debug filter, shared across all Logger instances. */
    static _debugFilters = new Map();

    /** @type {number|undefined} - Current shard ID, injected by bot.js after shard startup. */
    static _shardId = undefined;

    /** @type {import('pino').TransportMultiOptions} */
    static _pinoTransport = {
        targets: [
            {
                target: new URL('./transport.js', import.meta.url).href,
                level: 'trace',
                options: {},
            },
            {
                target: 'pino/file',
                level: 'trace',
                options: {
                    destination: Logger._getLogFilePath(),
                    mkdir: true,
                },
            },
        ],
    };

    /**
     * @param {import('pino').Logger} _pino - The underlying pino instance (root or child).
     * @param {DebugFilter} [filters] - Static filter merged into every call of this logger for filter matching.
     */
    constructor(_pino, filters = {}) {
        this._pino = _pino;
        this._filters = filters;
    }

    /** @returns {string} */
    static _getLogFilePath() {
        const date = new Date().toISOString().split('T')[0];
        const base = path.resolve(`./logs/${date}.log`);
        if(!fs.existsSync(base)) return base;
        for(let i = 1; ; i++) {
            const indexed = path.resolve(`./logs/${date}-${i}.log`);
            if(!fs.existsSync(indexed)) return indexed;
        }
    }

    // -------------------------------------------------------------------------
    // Log methods
    // -------------------------------------------------------------------------

    /** @param {DebugFilter} f
     * @returns {string} - A string represenation of the filter ("`feature`|`guildId`|`userId`")
     */
    static _filterKey(f) {
        return `${String(f.feature ?? '')}|${f.guildId ?? ''}|${f.userId ?? ''}`;
    }

    /**
     * Checks if a debug filter rule matches a debug call's filter. Matching logic:
     * - If the rule has a `feature`, the call's `feature` must be equal or start with the rule's `feature` + dot.
     *   (e.g. rule 'api.socketio' matches call 'api.socketio' and 'api.socketio.chat', but not 'api.http')
     * - If the rule has a `guildId`, the call's `guildId` must be equal.
     * - If the rule has a `userId`, the call's `userId` must be equal.
     * @param {DebugFilter} rule
     * @param {DebugFilter} filter
     * @returns {boolean}
     */
    static _ruleMatches(rule, filter) {
        if(rule.feature) {
            // Prefix matching: rule 'api.socketio' also matches 'api.socketio.chat'
            if(filter.feature !== rule.feature && !filter.feature.startsWith(`${rule.feature}.`)) return false;
        }
        if(rule.guildId && filter.guildId !== rule.guildId) return false;
        if(rule.userId && filter.userId !== rule.userId) return false;
        return true;
    }

    /**
     * Checks if any of the active debug filter match the filter for a specific log call, indicating it should be passed through.
     * @param {DebugFilter} filter
     * @returns {boolean}
     */
    static _shouldPassDebug(filter) {
        for(const rule of Logger._debugFilters.values())
            if(Logger._ruleMatches(rule, filter)) return true;
        return false;
    }

    /**
     * Extracts filter-relevant fields from the first log argument when it is a plain object.
     * Errors are excluded so `logger.error(err, 'msg')` calls are unaffected.
     * @param {*} objOrMsg
     * @returns {DebugFilter}
     */
    _callFilters(objOrMsg) {
        return objOrMsg !== null && typeof objOrMsg === 'object' && !(objOrMsg instanceof Error) ? objOrMsg : {};
    }

    trace(objOrMsg, msg) {
        if(Logger._debugFilters.size === 0) return;
        if(Logger._shouldPassDebug(Object.assign({}, this._filters, this._callFilters(objOrMsg))))
            this._pino.trace(objOrMsg, msg);
    }

    debug(objOrMsg, msg) {
        if(Logger._debugFilters.size === 0) return;
        if(Logger._shouldPassDebug(Object.assign({}, this._filters, this._callFilters(objOrMsg))))
            this._pino.debug(objOrMsg, msg);
    }

    info(objOrMsg, msg) { this._pino.info(objOrMsg, msg); }

    warn(objOrMsg, msg) { this._pino.warn(objOrMsg, msg); }

    // -------------------------------------------------------------------------
    // Debug filter helpers (static — operate on the shared filter map)
    // -------------------------------------------------------------------------

    error(objOrMsg, msg) { this._pino.error(objOrMsg, msg); }

    fatal(objOrMsg, msg) { this._pino.fatal(objOrMsg, msg); }

    /**
     * Creates a child Logger whose static filter include the parent's filter merged with
     * the provided ones. The `track` option is accepted for backwards compatibility but is a no-op.
     * @param {DebugFilter} filters
     * @param {{ track?: boolean } & import('pino').ChildLoggerOptions} [options]
     * @returns {Logger}
     */
    child(filters, options = {}) {
        const { track: _track, ...pinoOptions } = options;
        const normalized = {
            ...filters,
            feature: filters.feature != null ? String(filters.feature) : undefined,
        };
        const childPino = this._pino.child(normalized, pinoOptions);
        return new Logger(childPino, { ...this._filters, ...normalized });
    }

    // -------------------------------------------------------------------------
    // Private single-shard filter methods (called via broadcastEval)
    // -------------------------------------------------------------------------

    /**
     * Enables a debug filter on this shard only.
     * @param {DebugFilter} [filter={}]
     */
    _enableDebug(filter = {}) {
        const normalized = {
            ...filter,
            ...(filter.feature != null ? { feature: String(filter.feature) } : {}),
        };
        Logger._debugFilters.set(Logger._filterKey(normalized), normalized);
    }

    /**
     * Removes a debug filter on this shard only.
     * @param {DebugFilter} filter
     */
    _disableDebug(filter) {
        Logger._debugFilters.delete(Logger._filterKey(filter));
    }

    /** Clears all debug filter on this shard only. */
    _clearDebugFilters() {
        Logger._debugFilters.clear();
    }

    // -------------------------------------------------------------------------
    // Public cross-shard methods
    // -------------------------------------------------------------------------

    /**
     * Returns all currently active debug filter (local shard).
     * @returns {DebugFilter[]}
     */
    getDebugFilters() {
        return [...Logger._debugFilters.values()];
    }

    /**
     * Enables a debug filter on all shards via broadcastEval.
     * @param {MCLinker} client
     * @param {DebugFilter} [filter={}]
     * @returns {Promise<DebugFilter[]>}
     */
    async enableDebug(client, filter = {}) {
        await client.broadcastEval((c, { filter }) => c.logger._enableDebug(filter), { context: { filter } });
        return this.getDebugFilters();
    }

    /**
     * Removes a debug filter on all shards via broadcastEval.
     * @param {MCLinker} client
     * @param {DebugFilter} filter
     * @returns {Promise<DebugFilter[]>}
     */
    async disableDebug(client, filter) {
        await client.broadcastEval((c, { filter }) => c.logger._disableDebug(filter), { context: { filter } });
        return this.getDebugFilters();
    }

    /**
     * Clears all debug filter on all shards via broadcastEval.
     * @param {MCLinker} client
     * @returns {Promise<DebugFilter[]>}
     */
    async clearDebugFilters(client) {
        await client.broadcastEval(c => c.logger._clearDebugFilters());
        return this.getDebugFilters();
    }

    /**
     * Applies initial debug filter from a config array.
     * Each entry should be { feature?, guildId?, userId? }.
     * @param {DebugFilter[]} filters
     */
    applyInitialDebugFilters(filters) {
        if(!Array.isArray(filters) || filters.length === 0) return;
        for(const filter of filters) this._enableDebug(filter);
    }

    /**
     * Sets the shard ID used in the pino mixin.
     * @param {number} newShardId
     */
    setShardId(newShardId) {
        Logger._shardId = newShardId;
    }
}

const rootLogger = new Logger(
    pino({
        level: 'trace',
        mixin: () => ({ shardId: Logger._shardId !== undefined ? `${Logger._shardId}` : undefined }),
        transport: Logger._pinoTransport,
    }),
);

export default rootLogger;
