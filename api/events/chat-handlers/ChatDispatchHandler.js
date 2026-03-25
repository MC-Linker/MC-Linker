import rootLogger from '../../../utilities/logger.js';
import features from '../../../utilities/logFeatures.js';

const logger = rootLogger.child({ feature: features.api.socketio.chatHandlers.dispatch });


export default class ChatDispatchHandler {

    /**
     * @typedef {Object} QueueState
     * @property {QueueItem[]} items
     * @property {?number} timer
     * @property {boolean} processing
     * @property {boolean} batchMode
     * @property {boolean} highLoadActive
     * @property {number} skippedCount
     * @property {number} lastSummaryAt
     * @property {?QueueItem} lastItem
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
     * @param {number} [options.highLoadEnterThreshold=120]
     * @param {number} [options.highLoadExitThreshold=60]
     * @param {number} [options.highLoadSummaryIntervalMs=10000]
     * @param {(params: { key: string, items: Object[], batchMode: boolean }) => Promise<{ consumed: number, retryMs?: number, batchMode?: boolean }>} options.onProcess
     * @param {(params: { key: string, item: QueueItem, skippedCount: number, force: boolean }) => Promise<void>} [options.onHighLoadSkipped]
     */
    constructor(options) {
        /**
         * Number of queued items above which a destination switches to batch mode.
         * @type {number}
         */
        this.batchThreshold = options.batchThreshold;

        /**
         * Callback invoked to process a batch of queued items for a given destination.
         * @type {(params: { key: string, items: QueueItem[], batchMode: boolean }) => Promise<ProcessResult>}
         */
        this.onProcess = options.onProcess;

        /**
         * Callback invoked to emit skipped-message summaries during high-load drop mode.
         * @type {(params: { key: string, item: QueueItem, skippedCount: number, force: boolean }) => Promise<void>}
         */
        this.onHighLoadSkipped = options.onHighLoadSkipped ?? null;

        /**
         * Queue-size threshold to enter high-load drop mode.
         * @type {number}
         */
        this.highLoadEnterThreshold = options.highLoadEnterThreshold;

        /**
         * Queue-size threshold to leave high-load drop mode.
         * @type {number}
         */
        this.highLoadExitThreshold = options.highLoadExitThreshold;

        /**
         * Minimum interval between skipped summaries while high-load mode is active.
         * @type {number}
         */
        this.highLoadSummaryIntervalMs = options.highLoadSummaryIntervalMs;

        /**
         * Per-destination queue state, keyed by channel id.
         * @type {Map<string, QueueState>}
         */
        this.states = new Map();
    }

    /**
     * Enqueue a chat for processing.
     * @param {string} key - Unique identifier for the queue (channel Id).
     * @param {QueueItem} item - The item to be processed, e.g. chat message or channel event.
     */
    enqueue(key, item) {
        if(!key) return;

        if(!this.states.has(key)) {
            this.states.set(key, {
                items: [],
                timer: null,
                processing: false,
                batchMode: false,
                highLoadActive: false,
                skippedCount: 0,
                lastSummaryAt: 0,
                lastItem: null,
            });
        }

        const state = this.states.get(key);
        state.items.push(item);
        state.lastItem = item;
        // Enable batch mode if we exceed the threshold or cancel batch mode if we drop to 2 or fewer items
        state.batchMode = state.items.length > this.batchThreshold || state.batchMode && state.items.length > 2;

        this.scheduleProcess(key, 0);
    }

    /**
     * Returns the current queue size for a given key.
     * @param {string} key - Unique identifier for the queue.
     * @returns {number} The number of items in the queue, or 0 if the queue does not exist.
     */
    getQueueSize(key) {
        return this.states.get(key)?.items.length ?? 0;
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
     * Emits a high-load skipped summary if configured and due.
     * @param {string} key - Unique identifier for the queue.
     * @param {QueueState} state - The queue state.
     * @param {boolean} force - If true, emit immediately regardless of interval.
     * @returns {Promise<void>}
     */
    async emitHighLoadSummary(key, state, force) {
        if(!this.onHighLoadSkipped || state.skippedCount <= 0 || !state.lastItem) return;

        const now = Date.now();
        if(!force && now - state.lastSummaryAt < this.highLoadSummaryIntervalMs) return;

        try {
            logger.debug(`Emitting high-load summary for queue ${key} (skippedCount=${state.skippedCount}, force=${force})`);
            await this.onHighLoadSkipped({
                key,
                item: state.lastItem,
                skippedCount: state.skippedCount,
                force,
            });
            state.lastSummaryAt = now;
            state.skippedCount = 0;
        }
        catch(err) {
            logger.error(err, `Failed sending high-load summary for queue ${key}`);
        }
    }

    /**
     * Process the queue for the given key. Iterates through queued items and calls the onProcess callback.
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

                if(!state.highLoadActive && state.items.length > this.highLoadEnterThreshold) state.highLoadActive = true;
                if(state.highLoadActive && state.items.length < this.highLoadExitThreshold) {
                    await this.emitHighLoadSummary(key, state, true);
                    state.highLoadActive = false;
                }

                if(state.highLoadActive) {
                    state.skippedCount += state.items.length;
                    state.items.splice(0, state.items.length);
                    await this.emitHighLoadSummary(key, state, false);
                    this.scheduleProcess(key, this.highLoadSummaryIntervalMs);
                    return;
                }
                else if(state.skippedCount > 0) await this.emitHighLoadSummary(key, state, true);

                const result = await this.onProcess({
                    key,
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

            if(state.highLoadActive && state.items.length === 0) {
                await this.emitHighLoadSummary(key, state, true);
                state.highLoadActive = false;
            }

            if(state.items.length > 0) this.scheduleProcess(key, 0);
            else if(state.highLoadActive || state.skippedCount > 0) this.scheduleProcess(key, this.highLoadSummaryIntervalMs);
            else this.states.delete(key);
        }
        catch(err) {
            logger.error(err, `Failed processing queue ${key}`);
            this.scheduleProcess(key, 500);
        }
        finally {
            const nextState = this.states.get(key);
            if(nextState) nextState.processing = false;
        }
    }
}
