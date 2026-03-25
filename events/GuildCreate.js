import Event from '../structures/Event.js';
import { ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { sendToServer } from '../utilities/utils.js';
import rootLogger from '../utilities/logger.js';
import features from '../utilities/logFeatures.js';
import { Events } from 'discord.js';

const logger = rootLogger.child({ feature: features.events.guildCreate });

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

    async execute(client, guild) {
        logger.info(`Joined a guild: ${guild.name}: ${guild.memberCount} members. Shard is now on ${client.guilds.cache.size} servers!`);
        await sendToServer(
            guild,
            keys.main.success.invite,
            await ph.commandName('connect'),
            await ph.commandName('chatchannel add'),
            await ph.commandName('customize'),
        );
    }
} 