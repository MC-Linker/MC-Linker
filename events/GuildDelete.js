import Event from '../structures/Event.js';
import { addPh, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import logger from '../utilities/logger.js';

/**
 * Handles the Discord guildDelete event for the MC-Linker bot.
 * Logs when the bot is removed from a guild and cleans up connections.
 */
export default class GuildDelete extends Event {
    constructor() {
        super({ name: 'guildDelete' });
    }

    async execute(client, guild) {
        if(!client.isReady() || !guild.available) return;
        logger.info(addPh(keys.main.success.guild_delete.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
        await client.serverConnections.disconnect(guild.id);
        await client.serverSettingsConnections.disconnect(guild.id);
        await client.serverConnections.removeCache(guild.id);
    }
} 