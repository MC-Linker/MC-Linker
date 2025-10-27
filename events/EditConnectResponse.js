import Event from '../structures/Event.js';
import keys from '../utilities/keys.js';

/**
 * Handles the Discord ready event for the MC-Linker bot.
 * Logs the bot's login success and initializes various components.
 */
export default class EditConnectResponse extends Event {
    constructor() {
        super({
            name: 'editConnectResponse',
        });
    }

    async execute(client, id, responseType, placeholders = {}) {
        /** @type {Connect} */
        const connectCommand = client.commands.get('connect');

        if(!connectCommand.pendingInteractions.has(id)) return;
        const { timeout, interaction } = connectCommand.pendingInteractions.get(id);

        clearTimeout(timeout); // Works because event is called on same shard

        if(responseType === 'success')
            await interaction.replyTl(keys.commands.connect.success.websocket, placeholders);
        else if(responseType === 'error')
            await interaction.replyTl(keys.commands.connect.errors.websocket_error, placeholders);
    }
}