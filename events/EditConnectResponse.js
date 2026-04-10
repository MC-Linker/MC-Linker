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

    /**
     * @inheritdoc
     * @param client
     * @param {[string, 'success'|'error', Object]} args - [0] The connection ID, [1] The response type, [2] Optional placeholders for the response message.
     * @param logger
     */
    async run(client, [id, responseType, placeholders = {}], logger) {
        /** @type {Connect} */
        const connectCommand = client.commands.get('connect');

        if(!connectCommand.pendingInteractions.has(id)) return;
        const { timeout, interaction } = connectCommand.pendingInteractions.get(id);

        clearTimeout(timeout); // Works because event is called on same shard
        connectCommand.pendingInteractions.delete(id);

        if(responseType === 'success') await interaction.editReplyTl(keys.commands.connect.success.websocket, placeholders);
        else if(responseType === 'error') await interaction.editReplyTl(keys.commands.connect.errors.websocket_error, placeholders);
    }
}