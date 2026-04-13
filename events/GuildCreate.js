import Event from '../structures/Event.js';
import { ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { sendToServer } from '../utilities/utils.js';
import { Events } from 'discord.js';

/**
 * Handles the Discord guildCreate event for the MC-Linker bot.
 * Logs when the bot joins a new guild and sends a welcome message.
 */
export default class GuildCreate extends Event {
    constructor() {
        super({
            name: Events.GuildCreate,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').Guild]} args - [0] The guild.
     * @param logger
     */
    async run(client, [guild], logger) {
        logger.debug({ guildId: guild.id }, `Joined a guild: ${guild.name}: ${guild.memberCount} members. Shard is now on ${client.guilds.cache.size} servers!`);
        client.analytics.trackGuildJoin(guild.id, guild.memberCount);
        await sendToServer(
            guild,
            keys.main.success.invite,
            await ph.commandName('connect'),
            await ph.commandName('chatchannel add'),
            await ph.commandName('customize'),
        );
    }
} 