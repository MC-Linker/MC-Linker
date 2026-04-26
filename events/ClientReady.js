import Event from '../structures/Event.js';
import Canvas from 'skia-canvas';
import { Events } from 'discord.js';

/**
 * Handles the Discord ready event for the MC-Linker bot.
 * Logs the bot's login success and initializes various components.
 */
export default class ClientReady extends Event {
    constructor() {
        super({
            name: Events.ClientReady,
            once: true,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[]} args - No event arguments.
     * @param logger
     */
    async run(client, args, logger) {
        logger.info(`Bot logged in as ${client.user.tag} and with prefix: ${client.config.prefix}\nShard is on ${client.guilds.cache.size} servers.`);

        Canvas.FontLibrary.use('Minecraft', './resources/fonts/Minecraft.ttf');
    }
}