import { ShardEvents, ShardingManager } from 'discord.js';
import { AutoPoster } from 'topgg-autoposter';
import dotenv from 'dotenv';
import rootLogger from './utilities/logger/Logger.js';
import features from './utilities/logger/features.js';

dotenv.config();

const logger = rootLogger.child({ feature: features.core.startup });

const sharder = new ShardingManager('./bot.js', {
    token: process.env.TOKEN,
    execArgv: [`--max-old-space-size=${process.env.SHARD_MAX_HEAP_SIZE ?? 1024}`],
});

if(process.env.TOPGG_TOKEN) {
    const poster = AutoPoster(process.env.TOPGG_TOKEN, sharder);
    poster.on('posted', stats => logger.info(`Posted stats to Top.gg: ${stats.serverCount} servers`));
}

const readyShards = new Set();
sharder.on('shardCreate', shard => {
    logger.info(`Launched shard ${shard.id}`);
    shard.on(ShardEvents.Ready, async () => {
        logger.info(`Shard ${shard.id} ready`);
        readyShards.add(shard.id);
        if(readyShards.size === sharder.totalShards) {
            logger.info(`All ${sharder.totalShards} shards ready`);
            await sharder.broadcastEval(c => c.emit('allShardsReady'));
        }
    });
});
await sharder.spawn();
