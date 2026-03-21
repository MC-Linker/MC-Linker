import Discord, { RateLimitError, RESTJSONErrorCodes } from 'discord.js';
import logger from '../../../utilities/logger.js';
import { WEBHOOK_TOKEN_REFRESH_TTL_MS } from './ChatConstants.js';


export default class WebhookResolver {

    /**
     * @param {Object} options
     * @param {import('./WebhookPoolManager.js').default} options.poolManager
     * @param {import('./ChatMonitor.js').default} [options.monitor]
     */
    constructor({ poolManager, monitor }) {
        this.poolManager = poolManager;
        this.monitor = monitor;
    }

    /**
     * Refreshes a cached WebhookClient by fetching the webhook and replacing the cached entry.
     * Destroys the old client before creating a new one.
     * @param {import('discord.js').Client} client - The Discord client used to fetch webhooks.
     * @param {string} webhookId - The webhook ID to refresh.
     * @returns {Promise<?Discord.WebhookClient>} The new WebhookClient, or null if the fetch failed.
     */
    async refreshWebhookClient(client, webhookId) {
        const webhook = await client.fetchWebhook(webhookId);
        if(!webhook.token) return null;

        this.poolManager.evictWebhookClient(webhookId);
        const webhookClient = new Discord.WebhookClient(
            { id: webhookId, token: webhook.token },
            { rest: { rejectOnRateLimit: () => true } },
        );
        this.poolManager.webhookClients.set(webhookId, { client: webhookClient, cachedAt: Date.now() });
        return webhookClient;
    }

    /**
     * Resolves a sendable webhook for the given webhook ID, using cached WebhookClient instances.
     * Returns a cached WebhookClient when fresh, refreshes on stale cache, and tries pool alternatives on dead webhooks.
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

        const cachedEntry = this.poolManager.webhookClients.get(webhookId);
        const cachedFresh = cachedEntry && Date.now() - cachedEntry.cachedAt < WEBHOOK_TOKEN_REFRESH_TTL_MS;

        // Fast path: return cached WebhookClient directly
        if(cachedFresh) return cachedEntry.client;

        // Cache miss/stale cache: fetch to discover and refresh token
        try {
            const refreshed = await this.refreshWebhookClient(client, webhookId);
            if(refreshed) return refreshed;

            // Token not available — fall back to raw webhook
            return await client.fetchWebhook(webhookId);
        }
        catch(err) {
            if(err instanceof RateLimitError) {
                this.monitor?.recordRateLimit('fetchWebhook');
                logger.debug(`[Socket.io][Chat] Rate-limited refreshing webhook ${webhookId} for channel ${channelConfig.id}`);
                return null;
            }
            if(err?.code !== RESTJSONErrorCodes.UnknownWebhook) {
                logger.error(err, `[Socket.io][Chat] Failed fetching webhook ${webhookId} for channel ${channelConfig.id}`);
                return null;
            }
        }

        // Webhook is dead — evict and try pool alternatives
        this.poolManager.evictWebhookClient(webhookId);
        channelConfig.webhooks = (channelConfig.webhooks ?? []).filter(id => id !== webhookId);
        this.poolManager.webhookLastActive.delete(webhookId);

        for(const altId of [...(channelConfig.webhooks ?? [])]) {
            const altEntry = this.poolManager.webhookClients.get(altId);
            const altFresh = altEntry && Date.now() - altEntry.cachedAt < WEBHOOK_TOKEN_REFRESH_TTL_MS;
            if(altFresh) return altEntry.client;

            try {
                const refreshed = await this.refreshWebhookClient(client, altId);
                if(refreshed) return refreshed;

                return await client.fetchWebhook(altId);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    this.monitor?.recordRateLimit('fetchWebhook');
                    continue;
                }
                if(err?.code === RESTJSONErrorCodes.UnknownWebhook) {
                    this.poolManager.evictWebhookClient(altId);
                    channelConfig.webhooks = channelConfig.webhooks.filter(id => id !== altId);
                    this.poolManager.webhookLastActive.delete(altId);
                }
            }
        }

        // Pool exhausted — create new
        const newId = await this.poolManager.ensureWebhookForChatChannel(channelConfig, server, guild);
        if(!newId) return null;

        const newEntry = this.poolManager.webhookClients.get(newId);
        if(newEntry) return newEntry.client;

        return await client.fetchWebhook(newId)
            .catch(err => {
                logger.error(err, `[Socket.io][Chat] Failed fetching replacement webhook ${newId} for channel ${channelConfig.id}`);
                return null;
            });
    }
}
