import Event from '../structures/Event.js';
import { addPh, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import { sendToServer } from '../utilities/utils.js';
import logger from '../utilities/logger.js';
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

    async execute(client, guild) {
        logger.info(addPh(keys.main.success.guild_create.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
        await sendToServer(
            guild,
            keys.main.success.invite,
            ph.emojisAndColors(),
            await ph.commandName('connect', client, true),
            await ph.commandName('chatchannel add', client, true),
        );
    }
} 