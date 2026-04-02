import WSEvent from '../WSEvent.js';
import { RateLimitError, RESTJSONErrorCodes } from 'discord.js';
import rootLogger from '../../utilities/logger/logger.js';
import features from '../../utilities/logger/features.js';

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
     * Fetches the current name for a stats channel by querying fresh data from the plugin.
     * @param {StatsChannelData} channel - The stats channel configuration.
     * @param {ServerConnection} server - The server connection.
     * @param {boolean} [isOnline] - Explicit override for server online status. If omitted, determined by socket connectivity.
     * @returns {Promise<?string>} - The computed channel name, or null if an error occurred.
     */
    static async fetchCurrentName(channel, server, isOnline) {
        if(channel.type === 'member-counter') {
            if(isOnline === false) return channel.names.members.replace('%count%', '0');
            let onlinePlayers = await server.protocol.getOnlinePlayers();
            if(onlinePlayers == null) onlinePlayers = 0; // Assume 0 online if we can't reach server
            else if(onlinePlayers.status === 'error') {
                logger.debug({ guildId: server.id }, `Failed to fetch online players for channel ${channel.id}: ${onlinePlayers.error}`);
                return null;
            }
            else onlinePlayers = onlinePlayers.data.length;
            return channel.names.members.replace('%count%', onlinePlayers);
        }
        else if(channel.type === 'status') {
            const online = isOnline ?? server.protocol.isConnected();
            return online ? channel.names.online : channel.names.offline;
        }
        return null;
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
                const newName = await UpdateStatsChannel.fetchCurrentName(channel, server, isOnline);
                if(!newName) continue;

                await discordChannel.setName(newName);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    logger.debug({ guildId: server.id }, `Rate limited syncing channel ${channel.id}, scheduling retry in ${err.retryAfter}ms`);
                    UpdateStatsChannel.scheduleRetry(channel.id, err.retryAfter, channel, server.id, client);
                }
                else if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ statChannels: regChannel.data });
                }
                else logger.debug({ guildId: server.id }, `Failed to sync channel ${channel.id}: ${err.message}`);
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
                const newName = await UpdateStatsChannel.fetchCurrentName(channel, server);
                if(!newName) return pendingRetries.delete(channelId);

                await discordChannel.setName(newName);
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
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) return;
                    await server.edit({ statChannels: regChannel.data });
                }
                else logger.debug({ guildId: serverId }, `Failed to update channel ${channelId} on retry: ${err.message}`);
            }
        }, retryAfter);

        pendingRetries.set(channelId, timer);
    }

    /**
     * @inheritdoc
     * @param {UpdateStatsChannelRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        // event can be one of: 'online', 'offline', 'members'
        const { event } = data;

        const eventToTypeMap = {
            'online': 'status',
            'offline': 'status',
            'members': 'member-counter',
        };

        const channels = server.statChannels.filter(c => c.type === eventToTypeMap[event]);
        if(channels.length === 0) return; //No channels to update

        for(const channel of channels) {
            // If there's already a pending retry for this channel, drop this event.
            // The retry will fetch fresh data from the plugin when it fires.
            if(pendingRetries.has(channel.id)) continue;

            try {
                const discordChannel = await client.channels.fetch(channel.id);

                let newName;
                //Replace %count% with the actual count
                if(event === 'members') newName = channel.names[event].replace('%count%', data.members);
                else newName = channel.names[event];

                await discordChannel.setName(newName);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    logger.debug({ guildId: server.id }, `Rate limited for channel ${channel.id}, scheduling retry in ${err.retryAfter}ms`);
                    UpdateStatsChannel.scheduleRetry(channel.id, err.retryAfter, channel, server.id, client);
                }
                else if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ statChannels: regChannel.data });
                }
                else logger.debug({ guildId: server.id }, `Failed to update channel ${channel.id}: ${err.message}`);
            }
        }
    }
}