import rootLogger from '../utilities/logger/Logger.js';
import features from '../utilities/logger/features.js';

/**
 * @template T Request Data Type
 */
export default class WSEvent {

    /**
     * @typedef {object} WSEventOptions
     * @property {string} event - The websocket event of this route.
     * @property {import('rate-limiter-flexible').RateLimiterMemory|((data: Object) => ?RateLimiterMemory)} rateLimiter - The rate limiter for this event or a function that returns a rate limiter based on the request data.
     * @property {boolean} [dispatchToGuildShard=true] - Whether this event should be dispatched to the shard owning the guild. Set to false for events that must run on shard 0 (e.g. VerifyUser).
     */

    /**
     * @param {WSEventOptions} options - The options for this event.
     */
    constructor(options) {
        /**
         * The websocket event of this route.
         * @type {string}
         */
        this.event = options.event ?? null;

        /**
         * The rate limiter for this route or a function that returns a rate limiter based on the request data.
         * @type {import('rate-limiter-flexible').RateLimiterMemory|((data: Object) => ?RateLimiterMemory)}
         */
        this.rateLimiter = options.rateLimiter ?? null;

        /**
         * Whether this event should be dispatched to the shard owning the guild.
         * @type {boolean}
         */
        this.dispatchToGuildShard = options.dispatchToGuildShard ?? true;
    }

    /**
     * Handles a WS event. Creates a child logger and delegates to {@link run}.
     * @param {Object} data - The data sent with the request.
     * @param {ServerConnection} server - The server the event is sent to.
     * @param {MCLinker} client - The MCLinker client.
     * @returns {?object|void|Promise<object|void>}
     */
    execute(data, server, client) {
        const logger = rootLogger.child({
            feature: features.api.events[this.event],
            guildId: server?.id,
        }, { track: false });

        return this.run(data, server, client, logger);
    }

    /**
     * Implements the WS event's specific logic.
     * @param {T} data - The data sent with the request.
     * @param {?ServerConnection} server - The server the event is sent to.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('pino').Logger} logger - A child logger bound to this execution.
     * @returns {?ProtocolResponse|void|Promise<ProtocolResponse|void>}
     * @abstract
     */
    run(data, server, client, logger) {
        throw new Error(`The run method has not been implemented for the ${this.event} event.`);
    }
}
