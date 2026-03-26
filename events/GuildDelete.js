import Event from '../structures/Event.js';
import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';
import { Events } from 'discord.js';

const logger = rootLogger.child({ feature: features.events.guildDelete });

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

    async execute(client, guild) {
        if(!client.isReady() || !guild.available) return;
        logger.info(`Left a guild: ${guild.name}: ${guild.memberCount} members. Shard is now on ${client.guilds.cache.size} servers!`);
        await client.serverConnections.disconnect(guild.id);
        await client.serverSettingsConnections.disconnect(guild.id);
    }
} 