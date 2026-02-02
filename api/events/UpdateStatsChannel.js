import WSEvent from '../WSEvent.js';
import { RESTJSONErrorCodes } from 'discord.js';
import { RateLimiterMemory } from 'rate-limiter-flexible';


export default class UpdateStatsChannel extends WSEvent {

    /**
     * @typedef {Object} UpdateStatsChannelRequest
     * @property {'online'|'offline'|'members'} event
     * @property {number} [members] - Required if event is 'members'
     */

    /**
     * The rate limiter for stats-channel endpoints.
     * @type {RateLimiterMemory}
     */
    rateLimiterMemberCounter = new RateLimiterMemory({
        keyPrefix: 'member-counters',
        points: 2, // 2 updates
        duration: 60 * 5, // per 5 minutes
    });


    constructor() {
        super({
            event: 'update-stats-channels',
            rateLimiter: () => this.rateLimiterMemberCounter,
        });
    }

    /**
     * Handles stats-channel updates.
     * @param {UpdateStatsChannelRequest} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {Promise<void>}
     */
    async execute(data, server, client) {
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
            try {
                const discordChannel = await client.channels.fetch(channel.id);

                let newName;
                //Replace %count% with the actual count
                if(event === 'members') newName = channel.names[event].replace('%count%', data.members);
                else newName = channel.names[event];

                await discordChannel.setName(newName);
            }
            catch(err) {
                if(err.code === RESTJSONErrorCodes.UnknownChannel) {
                    const regChannel = await server.protocol.removeStatsChannel(channel);
                    if(!regChannel) continue;
                    await server.edit({ statChannels: regChannel.data });
                }
            }
        }
    }
}