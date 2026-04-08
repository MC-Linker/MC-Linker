import { RateLimitError } from 'discord.js';

/**
 * Accumulates chat pipeline metrics in memory.
 * The AnalyticsAggregator reads and resets these counters when it takes hourly snapshots.
 */
export default class ChatMonitor {

    /** @type {Map<string, { count: number, rateLimits: number }>} */
    operations = new Map();

    /** Chats received by execute() this interval. */
    incoming = 0;

    /** Items enqueued into the dispatch handler this interval. */
    enqueued = 0;

    /** Items consumed (processed) by queue processors this interval. */
    processed = 0;

    /** Rate limit rejections by category (e.g. 'webhook.send', 'createWebhook'). */
    rateLimitsByCategory = new Map();

    /** Channels where webhook creation failed due to missing ManageWebhooks permission. */
    permissionFailures = 0;

    /** Webhook creation failures (non-rate-limit, non-permission). */
    creationFailures = 0;

    /** @type {?import('./ChatDispatchHandler.js').default} */
    dispatchHandler = null;

    /**
     * Tracks an async operation's count and rate limit rejections.
     * @template T
     * @param {string} name - Operation name.
     * @param {() => Promise<T>} fn - The async function to execute.
     * @returns {Promise<T>}
     */
    async track(name, fn) {
        try {
            return await fn();
        }
        catch(err) {
            if(err instanceof RateLimitError) this._getOp(name).rateLimits++;
            throw err;
        }
        finally {
            this._getOp(name).count++;
        }
    }

    /**
     * @param {string} name
     * @returns {{ count: number, rateLimits: number }}
     */
    _getOp(name) {
        let op = this.operations.get(name);
        if(!op) {
            op = { count: 0, rateLimits: 0 };
            this.operations.set(name, op);
        }
        return op;
    }

    recordIncoming() { this.incoming++; }

    recordEnqueue() { this.enqueued++; }

    recordProcessed(n = 1) { this.processed += n; }

    /**
     * Records a rate limit rejection for a specific category.
     * @param {string} category - The operation that was rate-limited.
     */
    recordRateLimit(category) {
        this.rateLimitsByCategory.set(category, (this.rateLimitsByCategory.get(category) ?? 0) + 1);
    }

    recordPermissionFailure() { this.permissionFailures++; }

    recordCreationFailure() { this.creationFailures++; }

    /**
     * Returns a plain-object snapshot of all counters (safe for serialization).
     * Called by the AnalyticsAggregator when taking hourly snapshots.
     * @returns {object}
     */
    getCounters() {
        let queueDestinations = 0;
        let queueItems = 0;
        if(this.dispatchHandler) {
            for(const state of this.dispatchHandler.states.values()) {
                queueDestinations++;
                queueItems += state.items.length;
            }
        }

        return {
            throughput: { incoming: this.incoming, enqueued: this.enqueued, processed: this.processed },
            queue: { destinations: queueDestinations, items: queueItems },
            rateLimits: Object.fromEntries(this.rateLimitsByCategory),
            failures: { permission: this.permissionFailures, creation: this.creationFailures },
            operations: [...this.operations.entries()].map(([name, op]) => ({
                name, count: op.count, rateLimits: op.rateLimits,
            })),
        };
    }

    /**
     * Resets all accumulated counters. Called by the aggregator after taking a snapshot.
     */
    resetCounters() {
        this.incoming = 0;
        this.enqueued = 0;
        this.processed = 0;
        this.rateLimitsByCategory.clear();
        this.permissionFailures = 0;
        this.creationFailures = 0;
        this.operations.clear();
    }
}
