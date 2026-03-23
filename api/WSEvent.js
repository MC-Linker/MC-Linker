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
     * Handles a WS event for this route.
     * @param {Object} data - The data sent with the request.
     * @param {?ServerConnection} server - The server the event is sent to (if requiresServer is true).
     * @param {MCLinker} client - The MCLinker client.
     * @returns {?object|void|Promise<object|void>} - The response data.
     * @abstract
     */
    execute(data, server, client) {
        throw new Error(`The execute method has not been implemented for the ${this.event} event.`);
    }
}