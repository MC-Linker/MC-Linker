/**
 * @template T Request Data Type
 */
export default class Route {

    /**
     * @typedef {object} RouteResponse
     * @property {?number} status - The status code of the response.
     * @property {?object} body - The body of the response.
     */


    /**
     * @typedef {object} RouteOptions
     * @property {string} endpoint - The http endpoint of this route.
     * @property {boolean} [customBot=false] - Whether this route is only registered for custom bot instances.
     * @property {string[]} methods - The HTTP methods supported by this route.
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
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('fastify').FastifyRequest} req - The request data.
     * @param {import('fastify').FastifyRequest} res - The reply object to send the response.
     * @returns {RouteResponse|void|Promise<?RouteResponse|void>} - The response data.
     * @abstract
     */
    get(client, req, res);

    /**
     * Handles a POST request to this route.
     * @param {MCLinker} client - The client the request is sent to.
     * @param {import('fastify').FastifyRequest} req - The request data.
     * @param {import('fastify').FastifyRequest} res - The reply object to send the response.
     * @returns {RouteResponse|void|Promise<?RouteResponse|void>} - The response data.
     * @abstract
     */
    post(client, req, res);
}