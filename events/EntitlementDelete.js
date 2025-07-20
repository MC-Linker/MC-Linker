import Event from '../structures/Event.js';

/**
 * Handles the Discord entitlementDelete event for the MC-Linker bot.
 * Placeholder for future logic when an entitlement is deleted.
 * @TODO
 */
export default class EntitlementDelete extends Event {
    constructor() {
        super({
            name: 'entitlementDelete',
        });
    }

    async execute(client, entitlement) {
        // No logic implemented yet
    }
} 