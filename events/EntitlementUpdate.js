import Event from '../structures/Event.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord entitlementUpdate event for the MC-Linker bot.
 * Placeholder for future logic when an entitlement is updated.
 * @TODO
 */
export default class EntitlementUpdate extends Event {
    constructor() {
        super({
            name: Events.EntitlementUpdate,
        });
    }

    async execute(client, entitlement) {
        // No logic implemented yet
    }
} 