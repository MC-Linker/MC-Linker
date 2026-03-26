import Event from '../structures/Event.js';
import Canvas from 'skia-canvas';
import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';
import { Events } from 'discord.js';

const logger = rootLogger.child({ feature: features.events.clientReady });

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

    async execute(client, _) {
        logger.info(`Bot logged in as ${client.user.tag} and with prefix: ${client.config.prefix}\nShard is on ${client.guilds.cache.size} servers.`);

        Canvas.FontLibrary.use('Minecraft', './resources/fonts/Minecraft.ttf');
    }
}