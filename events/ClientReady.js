import Event from '../structures/Event.js';
import Canvas from 'skia-canvas';
import { addPh, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import logger from '../utilities/logger.js';
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

    async execute(client, _) {
        logger.info(addPh(
            keys.main.success.login.console,
            ph.client(client),
            { prefix: client.config.prefix, 'guild_count': client.guilds.cache.size },
        ));

        client.user.setPresence(client.config.presence);
        if(client.shard.ids.includes(0)) await client.api.startServer();

        Canvas.FontLibrary.use('Minecraft', './resources/fonts/Minecraft.ttf');

        await client.customBots.updateAllBots();
    }
}