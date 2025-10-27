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

    async execute(client, entitlement) {
        const user = await entitlement.fetchUser();
        const dm = await user.createDM();
        await dm.send(getReplyOptions(keys.custom_bot.success.subscribed, ph.commandName('customize', client, true)));
    }
}