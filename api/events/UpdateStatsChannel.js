import WSEvent from '../WSEvent.js';
import { RateLimitError, RESTJSONErrorCodes } from 'discord.js';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import { addPh } from '../../utilities/messages.js';

const logger = rootLogger.child({ feature: features.api.events['update-stats-channels'] });


/**
 * Pending retry timer Ids by channel Id.
 * When a rate limit is hit, we schedule a deferred re-sync for that channel and drop any subsequent updates until the retry fires.
 * @type {Map<string, number>}
 */
const pendingRetries = new Map();

export default class UpdateStatsChannel extends WSEvent {

    /**
     * @typedef {Object} UpdateStatsChannelRequest
     * @property {'online'|'offline'|'members'} event
     * @property {number} [members] - Required if event is 'members'
     */

    constructor() {
        super({
            event: 'update-stats-channels',
        });
    }

    /**
     * Applies a stat channel update to either the channel name or topic, based on the channel's updateTarget.
     * @param {import('discord.js').GuildChannel} discordChannel - The Discord channel to update.
     * @param {StatsChannelData} channel - The stats channel configuration.
     * @param {string} value - The rendered value to set.
     * @returns {Promise<import('discord.js').GuildChannel>}
     */
    static applyUpdate(discordChannel, channel, value) {
        return channel.updateTarget === 'topic'
            ? discordChannel.setTopic(value)
            : discordChannel.setName(value);
    }

    /**
     * Replaces stats channel placeholders in a template string.
     * @param {string} text - The template text.
     * @param {ServerConnection} server - The server connection.
     * @param {boolean} [isOnline=server.protocol.isConnected()] - Explicit override for server online status.
     * @param {number} [countOverride] - If provided, use this player count instead of fetching from the plugin.
     * @param {string} [channelId] - The stat channel id for logging.
     * @returns {Promise<?string>} - The text with placeholders replaced, or null if fetching the count failed.
     */
    static async applyPlaceholders(text, server, isOnline = server.protocol.isConnected(), countOverride, channelId) {
        let count = countOverride;
        if(text.includes('%count%')) {
            if(isOnline === false) count = 0;
            else if(count === undefined) {
                const resp = await server.protocol.getOnlinePlayers();
                if(resp == null) count = 0;
                else if(resp.status === 'error') {
                    logger.debug({ guildId: server.id }, `Failed to fetch online players for channel ${channelId ?? 'unknown'}: ${resp.error}`);
                    return null;
                }
                else count = resp.data.length;
            }
        }

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const time = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${String(now.getFullYear()).slice(2)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        return addPh(text, {
            count: count ?? 0,
            ip: server.displayIp ?? server.ip,
            time: time,
            version: server.version,
        });
    }

    /**
     * Computes the rendered value for a stats channel by resolving templates and fetching data as needed.
     * @param {StatsChannelData} channel - The stats channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {boolean} [isOnline] - Explicit override for server online status. If omitted, determined by socket connectivity.
     * @param {number} [countOverride] - If provided, use this player count instead of fetching from the plugin.
     * @returns {Promise<?string>} - The computed value, or null if an error occurred.
     */
    static async fetchCurrentName(channel, server, isOnline, countOverride) {
        const online = isOnline ?? server.protocol.isConnected();
        const template = online ? channel.names.online : channel.names.offline ?? channel.names.online;
        if(!template) return null;
        return UpdateStatsChannel.applyPlaceholders(template, server, online, countOverride, channel.id);
    }

    /**
     * Syncs all stat channels for a server to reflect the current state.
     * Used on reconnect (isOnline=true) and unexpected disconnect (isOnline=false).
     * @param {ServerConnection} server - The server connection.
     * @param {MCLinker} client - The MCLinker client.
     * @param {boolean} isOnline - Whether the server should be considered online.
     */
    static async syncAllStatChannels(server, client, isOnline) {
        for(const channel of server.statChannels) {
            // If there's already a pending retry for this channel, skip it.
            // The retry will fetch fresh data when it fires.
            if(pendingRetries.has(channel.id)) continue;

            try {
                const discordChannel = await client.channels.fetch(channel.id);
                const newValue = await UpdateStatsChannel.fetchCurrentName(channel, server, isOnline);
                if(!newValue) continue;

                await UpdateStatsChannel.applyUpdate(discordChannel, channel, newValue);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    logger.debug({ guildId: server.id }, `Rate limited syncing channel ${channel.id}, scheduling retry in ${err.retryAfter}ms`);
                    UpdateStatsChannel.scheduleRetry(channel.id, err.retryAfter, channel, server.id, client);
                }
                else if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const resp = await server.protocol.removeStatsChannel(channel);
                    if(!resp) continue;
                    await server.edit({ statChannels: server.statChannels.filter(c => c.id !== channel.id) });
                }
                else client.analytics.trackError('api_ws', `update-stats-channels-sync`, server.id, undefined, err, { channelId: channel.id }, logger);
            }
        }
    }

    /**
     * Schedules a deferred re-sync for a stats channel after a rate limit expires.
     * @param {string} channelId - The channel Id.
     * @param {number} retryAfter - Milliseconds until the rate limit resets.
     * @param {StatsChannelData} channel - The stats channel configuration.
     * @param {string} serverId - The server Id to re-resolve.
     * @param {MCLinker} client - The MCLinker client.
     */
    static scheduleRetry(channelId, retryAfter, channel, serverId, client) {
        if(pendingRetries.has(channelId)) return; // Already a pending retry for this channel

        const timer = setTimeout(async () => {
            // Re-resolve server to ensure it still exists
            const server = client.serverConnections.cache.get(serverId);
            if(!server) return pendingRetries.delete(channelId);

            // Verify this stat channel is still configured and get updated channel
            channel = server.statChannels.find(c => c.id === channelId);
            if(!channel) return pendingRetries.delete(channelId);

            try {
                const discordChannel = await client.channels.fetch(channelId);
                const newValue = await UpdateStatsChannel.fetchCurrentName(channel, server);
                if(!newValue) return pendingRetries.delete(channelId);

                await UpdateStatsChannel.applyUpdate(discordChannel, channel, newValue);
                pendingRetries.delete(channelId);
            }
            catch(err) {
                pendingRetries.delete(channelId);

                if(err instanceof RateLimitError) {
                    // Still rate limited — re-schedule
                    logger.debug({ guildId: serverId }, `Still rate limited for channel ${channelId}, retrying in ${err.retryAfter}ms`);
                    UpdateStatsChannel.scheduleRetry(channelId, err.retryAfter, channel, serverId, client);
                }
                else if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const resp = await server.protocol.removeStatsChannel(channel);
                    if(!resp) return;
                    await server.edit({ statChannels: server.statChannels.filter(c => c.id !== channelId) });
                }
                else client.analytics.trackError('api_ws', `update-stats-channels-retry`, serverId, undefined, err, { channelId }, logger);
            }
        }, retryAfter);

        pendingRetries.set(channelId, timer);
    }

    /**
     * Returns whether a stat channel uses dynamic placeholders that change on member events.
     * @param {StatsChannelData} channel - The stats channel configuration.
     * @returns {boolean}
     */
    static usesDynamicPlaceholders(channel) {
        const combined = [channel.names.online, channel.names.offline].filter(Boolean).join('');
        return combined.includes('%count%') || combined.includes('%time%');
    }

    /**
     * @inheritdoc
     * @param {UpdateStatsChannelRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        const { event } = data;
        const isOnline = event !== 'offline';

        // On 'members' events, skip channels without dynamic placeholders to avoid redundant Discord API calls
        const channels = event === 'members'
            ? server.statChannels.filter(c => UpdateStatsChannel.usesDynamicPlaceholders(c))
            : server.statChannels;
        if(channels.length === 0) return;

        for(const channel of channels) {
            // If there's already a pending retry for this channel, drop this event.
            // The retry will fetch fresh data from the plugin when it fires.
            if(pendingRetries.has(channel.id)) continue;

            try {
                const discordChannel = await client.channels.fetch(channel.id);
                const newValue = await UpdateStatsChannel.fetchCurrentName(channel, server, isOnline, data.members);
                if(!newValue) continue;

                await UpdateStatsChannel.applyUpdate(discordChannel, channel, newValue);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    logger.debug({ guildId: server.id }, `Rate limited for channel ${channel.id}, scheduling retry in ${err.retryAfter}ms`);
                    UpdateStatsChannel.scheduleRetry(channel.id, err.retryAfter, channel, server.id, client);
                }
                else if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const resp = await server.protocol.removeStatsChannel(channel);
                    if(!resp) continue;
                    await server.edit({ statChannels: server.statChannels.filter(c => c.id !== channel.id) });
                }
                else client.analytics.trackError('api_ws', `update-stats-channels`, server.id, undefined, err, { channelId: channel.id }, logger);
            }
        }
    }
}
