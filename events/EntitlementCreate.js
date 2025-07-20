import Event from '../structures/Event.js';
import { getReplyOptions } from '../utilities/messages.js';
import logger from '../utilities/logger.js';

/**
 * Handles the Discord entitlementCreate event for the MC-Linker bot.
 * Notifies users when they purchase an entitlement.
 */
export default class EntitlementCreate extends Event {
    constructor() {
        super({
            name: 'entitlementCreate',
        });
    }

    async execute(client, entitlement) {
        const user = await entitlement.fetchUser();
        const dm = await user.createDM();
        logger.info(`${user.username} (${user.id}) bought an entitlement!`);
        await dm.send(getReplyOptions(keys.entitlements.success.start));
    }
}