import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../../../utilities/logger.js';


export default class ChatDispatchHandler {

    /**
     * @typedef {'chat'|'channel'} QueueBucket
     */

    /**
     * @typedef {Object} QueueState
     * @property {QueueBucket} bucket
     * @property {QueueItem[]} items
     * @property {?number} timer
     * @property {boolean} processing
     * @property {boolean} batchMode
     */


    /**
     * Result returned by the onProcess callback to control queue consumption and scheduling.
     * @typedef {Object} ProcessResult
     * @property {number} consumed - The number of items consumed from the front of the queue.
     * @property {number} [retryMs] - If set, delay the next processing attempt by this many milliseconds.
     * @property {boolean} [batchMode] - If set, override the batch mode state for this destination.
     */

    /**
     * @param {Object} options
     * @param {number} [options.batchThreshold=5]
     * @param {number} [options.points=4]
     * @param {number} [options.duration=1]
     * @param {(params: { key: string, bucket: QueueBucket, items: Object[], batchMode: boolean }) => Promise<{ consumed: number, retryMs?: number, batchMode?: boolean }>} options.onProcess
     */
    constructor(options) {
        /**
         * Number of queued items above which a destination switches to batch mode.
         * @type {number}
         */
        this.batchThreshold = options.batchThreshold ?? 5;

        /**
         * Callback invoked to process a batch of queued items for a given destination.
         * @type {(params: { key: string, bucket: QueueBucket, items: QueueItem[], batchMode: boolean }) => Promise<ProcessResult>}
         */
        this.onProcess = options.onProcess;

        /**
         * Rate limiter for webhook destinations (all chat channels use webhooks).
         * @type {RateLimiterMemory}
         */
        this.limiter = new RateLimiterMemory({
            keyPrefix: 'chat-dispatch-webhook',
            points: options.points ?? 4, // 1 less than discord
            duration: options.duration ?? 1,
        });

        /**
         * Per-destination queue state, keyed by webhook or channel id.
         * @type {Map<string, QueueState>}
         */
        this.states = new Map();
    }

    /**
     * Enqueue a chat for processing.
     * @param {string} key - Unique identifier for the queue (webhook Id for chat, channel Id for channel).
     * @param {QueueBucket} bucket - The bucket to which this item belongs ('chat' or 'channel').
     * @param {QueueItem} item - The item to be processed, e.g. chat message or channel event.
     */
    enqueue(key, bucket, item) {
        if(!key) return;

        if(!this.states.has(key)) {
            this.states.set(key, {
                bucket,
                items: [],
                timer: null,
                processing: false,
                batchMode: false,
            });
        }

        const state = this.states.get(key);
        state.items.push(item);
        // Enable batch mode if we exceed the threshold or cancel batch mode if we drop to 2 or fewer items
        state.batchMode = state.items.length > this.batchThreshold || state.batchMode && state.items.length > 2;

        this.scheduleProcess(key, 0);
    }

    /**
     * Schedule processing of the queue after a delay. If already scheduled, it will reschedule with the new delay.
     * @param {string} key - Unique identifier for the queue.
     * @param {number} delayMs - Delay in milliseconds before processing the queue.
     */
    scheduleProcess(key, delayMs) {
        const state = this.states.get(key);
        if(!state) return;

        if(state.timer) clearTimeout(state.timer);

        state.timer = setTimeout(() => {
            state.timer = null;
            if(state.processing) {
                this.scheduleProcess(key, 50);
                return;
            }
            void this.processQueue(key);
        }, Math.max(delayMs, 0));
    }

    /**
     * Process the queue for the given key. It will consume items from the queue based on the rate limiter and call the onProcess callback.
     * @param {string} key - Unique identifier for the queue.
     * @returns {Promise<void>}
     */
    async processQueue(key) {
        const state = this.states.get(key);
        if(!state || state.processing) return;

        state.processing = true;

        try {
            let iterations = 0;
            // Safety guard of 12 iterations to even out scheduling
            while(state.items.length > 0 && iterations < 12) {
                iterations++;

                const limiter = this.limiter;
                try {
                    await limiter.consume(key);
                }
                catch(rejected) {
                    this.scheduleProcess(key, rejected?.msBeforeNext ?? 250);
                    return;
                }

                const result = await this.onProcess({
                    key,
                    bucket: state.bucket,
                    items: state.items,
                    batchMode: state.batchMode,
                });

                const consumed = Math.max(0, Number(result?.consumed ?? 0));
                if(typeof result?.batchMode === 'boolean') state.batchMode = result.batchMode;
                else state.batchMode = state.items.length > this.batchThreshold || state.batchMode && state.items.length > 2;

                if(consumed <= 0) {
                    this.scheduleProcess(key, result?.retryMs ?? 250);
                    return;
                }

                state.items.splice(0, consumed);

                if(result?.retryMs && state.items.length > 0) {
                    this.scheduleProcess(key, result.retryMs);
                    return;
                }
            }

            if(state.items.length > 0) this.scheduleProcess(key, 0);
            else this.states.delete(key);
        }
        catch(err) {
            logger.error(err, `[ChatDispatch] Failed processing queue ${key}`);
            this.scheduleProcess(key, 500);
        }
        finally {
            const nextState = this.states.get(key);
            if(nextState) nextState.processing = false;
        }
    }
}
