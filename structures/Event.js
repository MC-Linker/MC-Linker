import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';

/**
 * Base class for Discord event handlers in the MC-Linker bot.
 * Extend this class to implement custom event logic for Discord.js events.
 *
 * @example
 * // Example of extending the Event class for a ready event
 * import Event from './Event.js';
 * export default class ReadyEvent extends Event {
 *   constructor() {
 *     super({ name: 'ready', once: true });
 *   }
 *   async run(client, logger) {
 *     // Custom logic here
 *   }
 * }
 */
export default class Event {
    /**
     * @typedef {object} EventOptions
     * @property {string} name - The name of this event (from Discord.js Events).
     * @property {boolean} [once=false] - Whether this event should only be triggered once.
     * @property {number} [shard=-1] - The shard this event is for (-1 for all shards).
     */

    /**
     * Creates a new Event instance.
     * @param {EventOptions} options - The options for this event.
     */
    constructor(options) {
        /**
         * The name of this event.
         * @type {string}
         */
        this.name = options.name;

        /**
         * Whether this event should only be triggered once.
         * @type {boolean}
         */
        this.once = options.once ?? false;

        /**
         * The shard this event is for (-1 for all shards).
         * @type {number}
         */
        this.shard = options.shard ?? -1;
    }

    /**
     * Creates a child logger and delegates to {@link run}.
     * @param {MCLinker} client - The MCLinker client instance.
     * @param {...any} args - The event arguments as provided by Discord.js.
     * @returns {Promise<void>}
     */
    async execute(client, ...args) {
        const logger = rootLogger.child({
            feature: features.events[this.name],
        }, { track: false });

        return this.run(client, args, logger);
    }

    /**
     * Implements the event's specific logic.
     * @param {MCLinker} client - The MCLinker client instance.
     * @param {any[]} args - The event arguments as provided by Discord.js.
     * @param {import('pino').Logger} logger - A child logger bound to this execution.
     * @returns {Promise<void>}
     * @abstract
     */
    async run(client, args, logger) {
        throw new Error(`The run method has not been implemented in ${this.constructor.name}`);
    }
}
