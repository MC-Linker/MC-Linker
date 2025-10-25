import { ShardEvents, ShardingManager } from 'discord.js';
import { AutoPoster } from 'topgg-autoposter';
import dotenv from 'dotenv';

dotenv.config({ path: `./${process.env.DATA_FOLDER}/.env` });

const sharder = new ShardingManager('./bot.js', { token: process.env.TOKEN });

if(process.env.TOPGG_TOKEN) {
    const poster = AutoPoster(process.env.TOPGG_TOKEN, sharder);
    poster.on('posted', () => {});
}

const readyShards = new Set();
sharder.on('shardCreate', shard => {
    console.log(`Launched shard ${shard.id}`);
    shard.on(ShardEvents.Ready, async () => {
        console.log(`Shard ${shard.id} ready`);
        readyShards.add(shard.id);
        if(readyShards.size === sharder.totalShards) {
            console.log(`All ${sharder.totalShards} shards ready`);
            await sharder.broadcastEval(c => c.emit('allShardsReady'));
        }
    });
});
await sharder.spawn();
