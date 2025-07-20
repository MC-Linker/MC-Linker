import Event from '../structures/Event.js';
import keys from '../utilities/keys.js';
import { ph } from '../utilities/messages.js';

/**
 * Handles the Discord ready event for the MC-Linker bot.
 * Logs the bot's login success and initializes various components.
 */
export default class AccountVerificationResponse extends Event {
    constructor() {
        super({
            name: 'accountVerificationResponse',
            shard: 0,
        });
    }

    async execute(client, id) {
        /** @type {Account} */
        const accountCommand = client.commands.get('account');
        if(!accountCommand.pendingInteractions.has(id)) return;

        const { interaction, timeout } = accountCommand.pendingInteractions.get(id);
        clearTimeout(timeout); // Works because event is called on same shard
        interaction.replyTl(keys.commands.account.success.verified, ph.emojisAndColors());
    }
}