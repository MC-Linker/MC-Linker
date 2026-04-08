import Event from '../structures/Event.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord guildDelete event for the MC-Linker bot.
 * Logs when the bot is removed from a guild and cleans up connections.
 */
export default class GuildDelete extends Event {
    constructor() {
        super({
            name: Events.GuildDelete,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').Guild]} args - [0] The guild.
     * @param logger
     */
    async run(client, [guild], logger) {
        if(!client.isReady() || !guild.available) return;
        logger.debug(`Left a guild: ${guild.name}: ${guild.memberCount} members. Shard is now on ${client.guilds.cache.size} servers!`);
        client.analytics.trackGuildLeave(guild.id, guild.memberCount);
        await client.serverConnections.disconnect(guild.id);
        await client.serverSettingsConnections.disconnect(guild.id);
    }
} 