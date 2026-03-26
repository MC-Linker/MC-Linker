import pino from 'pino';
import path from 'path';
import fs from 'fs';

/**
 * @typedef {{ feature?: string, guildId?: string, userId?: string }} DebugFilter
 */

let shardId = undefined;

/**
 * Sets the log level across all shards.
 * @param {MCLinker} client - The MCLinker client instance.
 * @param {import('pino').LevelOrString} newLevel - The new log level to set.
 */
function setLogLevel(client, newLevel) {
    void client.broadcastEval((c, { newLevel }) => {
        c.logger.level = newLevel;
        c.logger.info(`Log level changed to: ${newLevel}`);
    }, {
        context: { newLevel },
    });
}

/**
 * Sets the log level for a specific shard.
 * @param {MCLinker} client - The MCLinker client instance.
 * @param {number} shard - The shard ID to set the log level for.
 * @param {import('pino').LevelOrString} newLevel - The new log level to set.
 */
function _setLogLevelForShard(client, shard, newLevel) {
    void client.broadcastEval((c, { newLevel }) => {
        c.logger.level = newLevel;
        c.logger.info(`Log level changed to: ${newLevel}`);
    }, {
        context: { newLevel },
        shard,
    });
}

/**
 * Sets the shard ID for the logger.
 * @param {number} newShardId - The new shard ID to set.
 */
function setShardId(newShardId) {
    shardId = newShardId;
}

function getLogFilePath() {
    const date = new Date().toISOString().split('T')[0];
    const base = path.resolve(`./logs/${date}.log`);
    if(!fs.existsSync(base)) return base;
    for(let i = 1; ; i++) {
        const indexed = path.resolve(`./logs/${date}-${i}.log`);
        if(!fs.existsSync(indexed)) return indexed;
    }
}

export const pinoTransport = {
    targets: [
        {
            target: new URL('./transport.js', import.meta.url).href,
            level: 'debug',
            options: {},
        },
        {
            target: 'pino/file',
            level: 'debug',
            options: {
                destination: getLogFilePath(),
                mkdir: true,
            },
        },
    ],
};

const rootLogger = pino({
    level: 'info',
    mixin: () => {
        return { shardId: shardId !== undefined ? `${shardId}` : undefined };
    },
    transport: pinoTransport,
});

/**
 * Active debug filters. Map key = canonical 'feature|guildId|userId' string.
 * Value = the filter object { feature?, guildId?, userId? }.
 * @type {Map<string, DebugFilter>}
 */
rootLogger._debugFilters = new Map();

/**
 * All tracked child loggers grouped by feature string, used to refresh levels when filters change.
 * @type {Map<string, Set<import('pino').Logger>>}
 */
rootLogger._trackedChildren = new Map();

function _filterKey(f) {
    return `${String(f.feature ?? '')}|${f.guildId ?? ''}|${f.userId ?? ''}`;
}

function _ruleMatches(rule, bindings) {
    if(rule.feature) {
        const feat = bindings.feature ?? '';
        // Prefix matching: rule 'api.socketio' also matches 'api.socketio.chat'
        if(feat !== rule.feature && !feat.startsWith(`${rule.feature}.`)) return false;
    }
    if(rule.guildId && bindings.guildId !== rule.guildId) return false;
    if(rule.userId && bindings.userId !== rule.userId) return false;
    return true;
}

function _shouldEnableDebug(bindings) {
    for(const rule of rootLogger._debugFilters.values())
        if(_ruleMatches(rule, bindings)) return true;
    return false;
}

function _refreshAllChildLevels() {
    rootLogger.level = rootLogger._debugFilters.size > 0 ? 'debug' : 'info';
    for(const [feature, children] of rootLogger._trackedChildren) {
        const level = _shouldEnableDebug({ feature }) ? 'debug' : 'info';
        for(const child of children) child.level = level;
    }
}

// Wrap child() to normalize the feature binding (handles logFeatures Proxy) and track children.
const _originalChild = rootLogger.child.bind(rootLogger);
rootLogger.child = function(bindings, options = {}) {
    const normalized = {
        ...bindings,
        feature: bindings.feature != null ? String(bindings.feature) : undefined,
    };

    const child = _originalChild(normalized, options);
    child.level = _shouldEnableDebug(normalized) ? 'debug' : 'info';

    if(normalized.feature) {
        if(!rootLogger._trackedChildren.has(normalized.feature)) rootLogger._trackedChildren.set(normalized.feature, new Set());
        rootLogger._trackedChildren.get(normalized.feature).add(child);
    }
    return child;
};

// Private single-shard methods (prefixed with _). Use the cross-shard public methods instead.
rootLogger._enableDebug = function(filter = {}) {
    const normalized = {
        ...filter,
        feature: filter.feature != null ? String(filter.feature) : undefined,
    };
    rootLogger._debugFilters.set(_filterKey(normalized), normalized);
    _refreshAllChildLevels();
    return rootLogger.getDebugFilters();
};

rootLogger._disableDebug = function(filter) {
    const normalized = {
        ...filter,
        feature: filter.feature != null ? String(filter.feature) : undefined,
    };
    rootLogger._debugFilters.delete(_filterKey(normalized));
    _refreshAllChildLevels();
    return rootLogger.getDebugFilters();
};

rootLogger._clearDebugFilters = function() {
    rootLogger._debugFilters.clear();
    _refreshAllChildLevels();
    return rootLogger.getDebugFilters();
};

/**
 * Returns all currently active debug filters.
 * @returns {DebugFilter[]}
 */
rootLogger.getDebugFilters = function() {
    return [...rootLogger._debugFilters.values()];
};

/**
 * Enables a debug filter on all shards via broadcastEval.
 * Feature matching uses prefix logic: enabling 'api.socketio' also enables 'api.socketio.chat'.
 * @param {MCLinker} client
 * @param {DebugFilter} [filter={}]
 */
rootLogger.enableDebug = function(client, filter = {}) {
    void client.broadcastEval((c, { filter }) => c.logger._enableDebug(filter), { context: { filter } });
};

/**
 * Removes a debug filter on all shards via broadcastEval.
 * @param {MCLinker} client
 * @param {DebugFilter} filter
 */
rootLogger.disableDebug = function(client, filter) {
    void client.broadcastEval((c, { filter }) => c.logger._disableDebug(filter), { context: { filter } });
};

/**
 * Clears all debug filters on all shards via broadcastEval.
 * @param {MCLinker} client
 */
rootLogger.clearDebugFilters = function(client) {
    void client.broadcastEval(c => c.logger._clearDebugFilters());
};

/**
 * Applies initial debug filters from a config array.
 * Each entry should be { feature?, guildId?, userId? }.
 * @param {DebugFilter[]} filters
 */
rootLogger.applyInitialDebugFilters = function(filters) {
    if(!Array.isArray(filters) || filters.length === 0) return;
    for(const filter of filters) rootLogger._enableDebug(filter);
};

rootLogger.setLogLevel = setLogLevel;
rootLogger.setLogLevelForShard = _setLogLevelForShard;
rootLogger.setShardId = setShardId;
rootLogger.debug('[Pino] Logger initialized');

await new Promise(r => setTimeout(r, 1000));
export default rootLogger;
