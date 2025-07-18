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
 *   async execute(client) {
 *     // Custom logic here
 *   }
 * }
 */
export default class Event {
    /**
     * @typedef {object} EventOptions
     * @property {string} name - The name of this event (from Discord.js Events).
     * @property {boolean} [once=false] - Whether this event should only be triggered once.
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
    }

    /**
     * Handles the execution of an event.
     * @param {MCLinker} client - The MCLinker client instance.
     * @param {...any} args - The event arguments as provided by Discord.js.
     * @returns {Promise<void>}
     * @abstract
     */
    async execute(client, ...args) {
        throw new Error(`The execute method has not been implemented in ${this.constructor.name}`);
    }
}