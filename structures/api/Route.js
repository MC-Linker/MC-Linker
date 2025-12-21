/**
 * @template T Request Data Type
 */
export default class Route {

    /**
     * @typedef {object} RouteOptions
     * @property {string} [endpoint] - The http endpoint of this route.
     * @property {string} [event] - The websocket event of this route.
     * @property {boolean} [requiresServer=true] - Whether this route requires a connected server.
     * @property {boolean} [customBot=false] - Whether this route is only registered for custom bot instances.
     * @property {string[]} [methods] - The HTTP methods supported by this route.
     * @property {import('rate-limiter-flexible').RateLimiterMemory|((data: Object) => ?RateLimiterMemory)} rateLimiter - The rate limiter for this route or a function that returns a rate limiter based on the request data.
     */

    /**
     * @param {RouteOptions} options - The options for this route.
     */
    constructor(options) {
        /**
         * The http endpoint of this route.
         * @type {string}
         */
        this.endpoint = options.endpoint ?? null;

        /**
         * The websocket event of this route.
         * @type {string}
         */
        this.event = options.event ?? null;

        if(this.endpoint === null && this.event === null)
            throw new Error('Route must have either an endpoint or an event defined.');

        /**
         * Whether this route requires a connected server.
         * @type {boolean}
         */
        this.requiresServer = options.requiresServer ?? true;

        /**
         * Whether this route is only registered for custom bot instances.
         * @type {boolean}
         */
        this.customBot = options.customBot ?? false;

        /**
         * The HTTP methods supported by this route.
         * @type {string[]}
         */
        this.methods = options.methods ?? [];

        /**
         * The rate limiter for this route or a function that returns a rate limiter based on the request data.
         * @type {import('rate-limiter-flexible').RateLimiterMemory|((data: Object) => ?RateLimiterMemory)}
         */
        this.rateLimiter = options.rateLimiter ?? null;
    }

    /**
     * Handles a GET request to this route.
     * @param {import('fastify').Request} request - The request data.
     * @param {import('fastify').Reply} reply - The reply object to send the response.
     * @param {MCLinker} client - The MCLinker client.
     * @returns {Promise<?RouteResponse|void>} - The response data.
     * @abstract
     */
    get(request, reply, client);

    /**
     * Handles a POST request to this route.
     * @param {import('fastify').Request} request - The request data.
     * @param {import('fastify').Reply} reply - The reply object to send the response.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<?RouteResponse|void>} - The response data.
     * @abstract
     */
    post(request, reply, client);

    /**
     * Handles a WS event for this route.
     * @param {ChatRequest} data - The data sent with the request.
     * @param {?ServerConnection} server - The server the event is sent to (if requiresServer is true).
     * @param {MCLinker} client - The MCLinker client.
     * @returns {Promise<?RouteResponse|void>} - The response data.
     * @abstract
     */
    ws(data, server, client);
}