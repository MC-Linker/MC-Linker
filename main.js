import { ShardEvents, ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
import logger from './utilities/logger.js';

dotenv.config({ path: `${process.env.DATA_FOLDER}/.env` });

const manager = new ShardingManager('./bot.js', { token: process.env.TOKEN });

const readyShards = new Set();
manager.on('shardCreate', shard => {
    logger.info(`Launched shard ${shard.id}`);
    shard.on(ShardEvents.Ready, async () => {
        logger.info(`Shard ${shard.id} ready`);
        readyShards.add(shard.id);
        if(readyShards.size === manager.totalShards)
            logger.info(`All ${manager.totalShards} shards ready`);
    });
});
await manager.spawn();
