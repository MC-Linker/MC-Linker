import { ShardEvents, ShardingManager } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const manager = new ShardingManager('./bot.js', { token: process.env.TOKEN });

const readyShards = new Set();
manager.on('shardCreate', shard => {
    console.log(`Launched shard ${shard.id}`);
    shard.on(ShardEvents.Ready, async () => {
        console.log(`Shard ${shard.id} ready`);
        readyShards.add(shard.id);
        if(readyShards.size === manager.totalShards) {
            console.log(`All ${manager.totalShards} shards ready`);
            await manager.broadcastEval(c => c.emit('allShardsReady'));
        }
    });
});
await manager.spawn();
