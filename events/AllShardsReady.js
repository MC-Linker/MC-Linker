import Event from '../structures/Event.js';

export default class AllShardsReady extends Event {

    constructor() {
        super({
            name: 'allShardsReady',
            once: true,
            shard: 0,
        });
    }

    async execute(client, ...args) {
        await client.api.startServer();
        await client.customBots.updateAllBots();
    }
}