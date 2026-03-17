import Discord, { RESTJSONErrorCodes } from 'discord.js';
import logger from '../../../utilities/logger.js';
import { WEBHOOK_TOKEN_REFRESH_TTL_MS } from './ChatConstants.js';


export default class WebhookResolver {

    /**
     * @param {Object} options
     * @param {import('./WebhookPoolManager.js').default} options.poolManager
     */
    constructor({ poolManager }) {
        this.poolManager = poolManager;
    }

    /**
     * Resolves a sendable webhook for the given webhook ID, using the token cache to avoid API calls.
     * Returns a WebhookClient constructed from cached tokens when possible,
     * falling back to fetchWebhook on cache miss, and trying pool alternatives on dead webhooks.
     * @param {import('discord.js').Client} client - The Discord client used to fetch webhooks on cache miss.
     * @param {import('discord.js').Guild} guild - The guild the channel belongs to.
     * @param {ServerConnection} server - The server connection.
     * @param {ChatChannelData} channelConfig - The chat channel configuration object.
     * @param {string} webhookId - The webhook ID to resolve.
     * @returns {Promise<?(Discord.WebhookClient|Discord.Webhook)>} A sendable webhook, or null.
     */
    async resolve(client, guild, server, channelConfig, webhookId) {
        if(!webhookId) {
            webhookId = await this.poolManager.ensureWebhookForChatChannel(channelConfig, server, guild);
            if(!webhookId) return null;
        }

        const cachedEntry = this.poolManager.webhookTokens.get(webhookId);
        const cachedTokenFresh = cachedEntry && Date.now() - cachedEntry.cachedAt < WEBHOOK_TOKEN_REFRESH_TTL_MS;

        // Fast path: use fresh cached token to create WebhookClient without an API call
        if(cachedTokenFresh) return new Discord.WebhookClient({ id: webhookId, token: cachedEntry.token });

        // Cache miss/stale cache: fetch to discover and refresh token
        try {
            const webhook = await client.fetchWebhook(webhookId);
            if(webhook.token) {
                this.poolManager.webhookTokens.set(webhookId, { token: webhook.token, cachedAt: Date.now() });
                return new Discord.WebhookClient({ id: webhookId, token: webhook.token });
            }
            return webhook;
        }
        catch(err) {
            if(err?.code !== RESTJSONErrorCodes.UnknownWebhook) {
                logger.error(err, `[Socket.io][Chat] Failed fetching webhook ${webhookId} for channel ${channelConfig.id}`);
                return null;
            }
        }

        // Webhook is dead — evict and try pool alternatives
        this.poolManager.webhookTokens.delete(webhookId);
        channelConfig.webhooks = (channelConfig.webhooks ?? []).filter(id => id !== webhookId);
        this.poolManager.webhookLastActive.delete(webhookId);

        for(const altId of [...(channelConfig.webhooks ?? [])]) {
            const altEntry = this.poolManager.webhookTokens.get(altId);
            const altFresh = altEntry && Date.now() - altEntry.cachedAt < WEBHOOK_TOKEN_REFRESH_TTL_MS;
            if(altFresh) return new Discord.WebhookClient({ id: altId, token: altEntry.token });

            try {
                const webhook = await client.fetchWebhook(altId);
                if(webhook.token) {
                    this.poolManager.webhookTokens.set(altId, { token: webhook.token, cachedAt: Date.now() });
                    return new Discord.WebhookClient({ id: altId, token: webhook.token });
                }
                return webhook;
            }
            catch(err) {
                if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                    this.poolManager.webhookTokens.delete(altId);
                    channelConfig.webhooks = channelConfig.webhooks.filter(id => id !== altId);
                    this.poolManager.webhookLastActive.delete(altId);
                }
            }
        }

        // Pool exhausted — create new
        const newId = await this.poolManager.ensureWebhookForChatChannel(channelConfig, server, guild);
        if(!newId) return null;

        const newEntry = this.poolManager.webhookTokens.get(newId);
        if(newEntry) return new Discord.WebhookClient({ id: newId, token: newEntry.token });

        return await client.fetchWebhook(newId)
            .catch(err => {
                logger.error(err, `[Socket.io][Chat] Failed fetching replacement webhook ${newId} for channel ${channelConfig.id}`);
                return null;
            });
    }
}
