import Event from '../structures/Event.js';
import { Events } from 'discord.js';
import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.events.entitlementDelete });

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