import { ShardEvents, ShardingManager } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const manager = new ShardingManager('./bot.js', { token: process.env.TOKEN, totalShards: 2 });

const readyShards = new Set();
manager.on('shardCreate', shard => {
    console.log(`Launched shard ${shard.id}`);
    shard.on(ShardEvents.Ready, () => {
        console.log(`Shard ${shard.id} ready`);
        readyShards.add(shard.id);
        if(readyShards.size === manager.totalShards) {
            console.log(`All ${manager.totalShards} shards ready`);
            manager.broadcastEval(c => c.emit('allShardsReady'));
        }
    });
});
await manager.spawn();
