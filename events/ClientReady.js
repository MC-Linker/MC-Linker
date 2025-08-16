import Event from '../structures/Event.js';
import Canvas from 'skia-canvas';
import { addPh, ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import logger from '../utilities/logger.js';
import { ActivityType } from 'discord.js';

/**
 * Handles the Discord ready event for the MC-Linker bot.
 * Logs the bot's login success and initializes various components.
 */
export default class ClientReady extends Event {
    constructor() {
        super({
            name: 'ready',
            once: true,
        });
    }

    async execute(client, _) {
        logger.setShardId(client.shard.ids[0]);

        logger.info(addPh(
            keys.main.success.login.console,
            ph.client(client),
            { prefix: process.env.PREFIX, 'guild_count': client.guilds.cache.size },
        ));

        client.user.setActivity({ type: ActivityType.Listening, name: '/help' });
        if(client.shard.ids.includes(0)) await client.api.startServer();

        Canvas.FontLibrary.use('Minecraft', './resources/fonts/Minecraft.ttf');
    }
}