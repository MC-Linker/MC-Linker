import Event from '../structures/Event.js';
import { getReplyOptions, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord entitlementCreate event for the MC-Linker bot.
 * Notifies users when they purchase an entitlement.
 */
export default class EntitlementCreate extends Event {
    constructor() {
        super({
            name: Events.EntitlementCreate,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').Entitlement]} args - [0] The entitlement.
     * @param logger
     */
    async run(client, [entitlement], logger) {
        const user = await entitlement.fetchUser();
        logger.info(`Entitlement created by user ${user.displayName} (${user.id})`);
        const dm = await user.createDM();
        await dm.send(getReplyOptions(keys.custom_bot.success.subscribed, await ph.commandName('customize')));
    }
}