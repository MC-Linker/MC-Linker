import { RateLimitError } from 'discord.js';
import logger from '../../../utilities/logger.js';

const SUMMARY_INTERVAL_MS = 30_000;


export default class ChatMonitor {

    /** @type {Map<string, { count: number, totalMs: number, minMs: number, maxMs: number, rateLimits: number }>} */
    operations = new Map();

    /** Chats received by execute() this interval. */
    incoming = 0;

    /** Items enqueued into the dispatch handler this interval. */
    enqueued = 0;

    /** Items consumed (processed) by queue processors this interval. */
    processed = 0;

    /** Channels skipped because they had no webhooks array. */
    skippedNoWebhooks = 0;

    /** Channels that still had the legacy singular `webhook` property. */
    legacyWebhookProp = 0;

    /** Channels with a `webhooks` array that was empty. */
    emptyWebhooks = 0;

    /** Channels with a filled `webhooks` array (healthy). */
    readyWebhooks = 0;

    /** Currently suspended execute() calls. */
    executeConcurrent = 0;

    /** Peak concurrent execute() calls this interval. */
    executePeak = 0;

    /** Total execute() calls completed this interval. */
    executeCompleted = 0;

    /** Total milliseconds spent inside execute() this interval. */
    executeTotalMs = 0;

    /** @type {?import('./ChatDispatchHandler.js').default} */
    dispatchHandler = null;

    constructor() {
        this.timer = setInterval(() => this.emitSummary(), SUMMARY_INTERVAL_MS);
        if(this.timer.unref) this.timer.unref();
    }

    /**
     * Tracks an async operation's duration and rate limit rejections.
     * @template T
     * @param {string} name - Operation name shown in the summary.
     * @param {() => Promise<T>} fn - The async function to execute and measure.
     * @returns {Promise<T>}
     */
    async track(name, fn) {
        const start = Date.now();
        try {
            return await fn();
        }
        catch(err) {
            if(err instanceof RateLimitError) this._getOp(name).rateLimits++;
            throw err;
        }
        finally {
            const ms = Date.now() - start;
            const op = this._getOp(name);
            op.count++;
            op.totalMs += ms;
            if(ms < op.minMs) op.minMs = ms;
            if(ms > op.maxMs) op.maxMs = ms;
        }
    }

    /**
     * @param {string} name
     * @returns {{ count: number, totalMs: number, minMs: number, maxMs: number, rateLimits: number }}
     */
    _getOp(name) {
        let op = this.operations.get(name);
        if(!op) {
            op = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, rateLimits: 0 };
            this.operations.set(name, op);
        }
        return op;
    }

    recordIncoming() { this.incoming++; }

    recordEnqueue() { this.enqueued++; }

    recordProcessed(n = 1) { this.processed += n; }

    /**
     * Records the webhook state of a chat channel encountered during execute().
     * @param {object} channel - The chat channel config object.
     */
    recordChannelState(channel) {
        if(channel.webhook !== undefined) this.legacyWebhookProp++;
        if(!channel.webhooks) this.skippedNoWebhooks++;
        else if(channel.webhooks.length === 0) this.emptyWebhooks++;
        else this.readyWebhooks++;
    }

    enterExecute() {
        this.executeConcurrent++;
        if(this.executeConcurrent > this.executePeak) this.executePeak = this.executeConcurrent;
    }

    exitExecute(startMs) {
        this.executeConcurrent--;
        this.executeCompleted++;
        this.executeTotalMs += Date.now() - startMs;
    }

    emitSummary() {
        const secs = SUMMARY_INTERVAL_MS / 1000;
        const mem = process.memoryUsage();
        const heap = Math.round(mem.heapUsed / 1024 / 1024);
        const rss = Math.round(mem.rss / 1024 / 1024);

        let queueDestinations = 0;
        let queueItems = 0;
        if(this.dispatchHandler) {
            for(const state of this.dispatchHandler.states.values()) {
                queueDestinations++;
                queueItems += state.items.length;
            }
        }

        const executeAvg = this.executeCompleted > 0 ? Math.round(this.executeTotalMs / this.executeCompleted) : 0;

        const lines = [
            `[ChatMonitor] ${secs}s summary | heap=${heap}MB rss=${rss}MB`,
            `  throughput: in=${this.incoming} (${(this.incoming / secs).toFixed(1)}/s) enqueued=${this.enqueued} processed=${this.processed}`,
            `  execute(): concurrent=${this.executeConcurrent} peak=${this.executePeak} completed=${this.executeCompleted} avg=${executeAvg}ms`,
            `  dispatch: ${queueDestinations} destinations, ${queueItems} queued items`,
            `  channels: ready=${this.readyWebhooks} empty=${this.emptyWebhooks} noArray=${this.skippedNoWebhooks} legacyProp=${this.legacyWebhookProp}`,
        ];

        if(this.operations.size > 0) {
            const parts = [];
            for(const [name, op] of this.operations) {
                const avg = op.count > 0 ? Math.round(op.totalMs / op.count) : 0;
                const min = op.minMs === Infinity ? 0 : op.minMs;
                let s = `${name}: ${op.count}× avg=${avg}ms max=${op.maxMs}ms`;
                if(min !== avg) s = `${name}: ${op.count}× avg=${avg}ms min=${min}ms max=${op.maxMs}ms`;
                if(op.rateLimits > 0) s += ` rl=${op.rateLimits}`;
                parts.push(s);
            }
            lines.push('  ops: ' + parts.join('\n       '));
        }

        logger.info(lines.join('\n'));

        // Reset for next interval
        this.incoming = 0;
        this.enqueued = 0;
        this.processed = 0;
        this.executePeak = this.executeConcurrent;
        this.executeCompleted = 0;
        this.executeTotalMs = 0;
        this.skippedNoWebhooks = 0;
        this.legacyWebhookProp = 0;
        this.emptyWebhooks = 0;
        this.readyWebhooks = 0;
        this.operations.clear();
    }
}
