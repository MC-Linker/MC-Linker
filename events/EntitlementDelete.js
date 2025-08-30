import Event from '../structures/Event.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord entitlementDelete event for the MC-Linker bot.
 * Placeholder for future logic when an entitlement is deleted.
 * @TODO
 */
export default class EntitlementDelete extends Event {
    constructor() {
        super({
            name: Events.EntitlementDelete,
        });
    }

    async execute(client, entitlement) {
        // No logic implemented yet
    }
} 