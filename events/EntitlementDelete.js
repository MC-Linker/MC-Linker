import Event from '../structures/Event.js';
import { Events } from 'discord.js';
import logger from '../utilities/logger.js';

/**
 * Handles the Discord entitlementDelete event for the MC-Linker bot.
 */
export default class EntitlementDelete extends Event {
    constructor() {
        super({
            name: Events.EntitlementDelete,
        });
    }

    async execute(client, entitlement) {
        const user = await entitlement.fetchUser();
        logger.info(`Entitlement deleted for user ${user.displayName}`);

        await client.customBots.disconnect(client.customBots.getCustomBot(user.id));
    }
}