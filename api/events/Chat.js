import WSEvent from '../WSEvent.js';
import keys from '../../utilities/keys.js';
import { getCachedAvatarURL, parseMentions, searchAdvancements } from '../../utilities/utils.js';
import { addPh, getEmbed } from '../../utilities/messages.js';
import logger from '../../utilities/logger.js';
import ChatDispatchHandler from './chat-handlers/ChatDispatchHandler.js';
import WebhookPoolManager from './chat-handlers/WebhookPoolManager.js';
import WebhookResolver from './chat-handlers/WebhookResolver.js';
import ChatQueueProcessor from './chat-handlers/ChatQueueProcessor.js';
import {
    DISPATCH_HIGH_LOAD_ENTER_THRESHOLD,
    DISPATCH_HIGH_LOAD_EXIT_THRESHOLD,
    DISPATCH_HIGH_LOAD_SUMMARY_INTERVAL_MS,
} from './chat-handlers/ChatConstants.js';

/**
 * @typedef {Object} ChatRequest
 * @property {'chat'|'console'|'join'|'quit'|'death'|'advancement'|'player_command'|'console_command'|'block_command'|'start'|'close'} type
 * @property {string} message
 * @property {string} [player] - Required for type 'chat', 'join', 'quit', 'death', 'advancement', 'player_command'
 */


export default class Chat extends WSEvent {

    /** @type {ChatDispatchHandler} */
    dispatchHandler;

    /** @type {WebhookPoolManager} */
    poolManager;

    /** @type {WebhookResolver} */
    resolver;

    /** @type {ChatQueueProcessor} */
    queueProcessor;

    constructor() {
        super({
            event: 'chat',
        });

        this.poolManager = new WebhookPoolManager();

        this.resolver = new WebhookResolver({
            poolManager: this.poolManager,
        });

        this.queueProcessor = new ChatQueueProcessor({
            resolver: this.resolver,
            poolManager: this.poolManager,
        });

        this.dispatchHandler = new ChatDispatchHandler({
            batchThreshold: 5,
            points: 5,
            duration: 2,
            highLoadEnterThreshold: DISPATCH_HIGH_LOAD_ENTER_THRESHOLD,
            highLoadExitThreshold: DISPATCH_HIGH_LOAD_EXIT_THRESHOLD,
            highLoadSummaryIntervalMs: DISPATCH_HIGH_LOAD_SUMMARY_INTERVAL_MS,
            onProcess: this.queueProcessor.processDispatchQueue.bind(this.queueProcessor),
            onHighLoadSkipped: this.queueProcessor.handleHighLoadSkipped.bind(this.queueProcessor),
        });

        // Back-patch references that require circular wiring
        this.poolManager.dispatchHandler = this.dispatchHandler;
        this.poolManager.lastConsoleMessages = this.queueProcessor.lastConsoleMessages;
    }

    /**
     * Handles chat channel messages.
     * @param {ChatRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async execute(data, server, client) {
        const { type, player } = data;
        let message = data.message ?? '';

        const channels = server.chatChannels.filter(c => c.types.includes(type));
        if(channels.length === 0) return; //No channels to send to

        //Check whether command is blocked
        if(['player_command', 'console_command', 'block_command'].includes(type) && server.settings.isFilteredCommand(message)) return;

        const guildId = server.id;
        const authorURL = player ? await getCachedAvatarURL(player) : null;

        const placeholders = { username: player, author_url: authorURL, message };

        //Add special placeholders for advancements
        if(type === 'advancement') {
            if(message.startsWith('minecraft:recipes')) return; //Dont process recipes

            const [category, id] = message.replace('minecraft:', '').split('/');
            const advancement = searchAdvancements(id, category, false, true, 1)[0];

            if(!advancement) return; // Advancement not found

            const advancementTitle = advancement?.name ?? message;
            const advancementDesc = advancement?.description ?? keys.commands.advancements.no_description_available;

            // Add placeholder to argPlaceholder so it can be used later
            placeholders.advancement_title = advancementTitle;
            placeholders.advancement_description = advancementDesc;
        }
        else if(type === 'death' && (!message || message === '')) placeholders.message = addPh(keys.api.plugin.success.default_death_message, placeholders);

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if(!guild) return;

        const isChat = type === 'chat';
        const isConsole = type === 'console';

        if((isChat || isConsole) && !message) return;
        if(isChat && !this.poolManager.isUnderHighLoad(channels)) placeholders.message = await parseMentions(placeholders.message, guild);

        const mode = isChat ? 'chat' : isConsole ? 'console' : 'embed';
        const chatEmbed = !isChat && !isConsole ? getEmbed(keys.api.plugin.success.messages[type], placeholders, { 'timestamp_now': Date.now() }) : null;

        for(const channel of channels) {
            const webhookId = await this.poolManager.selectWebhook(channel, server, guild, mode);
            if(!webhookId) continue;

            logger.debug(`[Socket.io][Chat] Enqueue ${mode} payload for channel ${channel.id} via webhook ${webhookId}`);

            const base = { client, serverId: server.id, guildId, channelId: channel.id, webhookId };

            if(isChat)
                this.dispatchHandler.enqueue(webhookId, {
                    ...base,
                    kind: 'chat',
                    player,
                    authorURL,
                    message: placeholders.message,
                });
            else if(isConsole)
                this.dispatchHandler.enqueue(webhookId, { ...base, kind: 'console', raw: message });
            else
                this.dispatchHandler.enqueue(webhookId, { ...base, kind: 'embed', embed: chatEmbed });
        }
    }
}
