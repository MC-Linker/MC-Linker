import Event from '../structures/Event.js';
import { addPh, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import logger from '../utilities/logger.js';
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

    async execute(client, guild) {
        if(!client.isReady() || !guild.available) return;
        logger.info(addPh(keys.main.success.guild_delete.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
        await client.serverConnections.disconnect(guild.id);
        await client.serverSettingsConnections.disconnect(guild.id);
    }
} 