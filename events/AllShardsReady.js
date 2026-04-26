import Event from '../structures/Event.js';
import AnalyticsAggregator from '../structures/analytics/AnalyticsAggregator.js';

export default class AllShardsReady extends Event {

    constructor() {
        super({
            name: 'allShardsReady',
            once: true,
            shard: 0,
        });
    }

    async run(client, args, logger) {
        await client.api.startServer();
        await client.customBots.disconnectUsersWithoutEntitlement();
        await client.customBots.updateAllBots();

        client.analyticsAggregator = new AnalyticsAggregator(client);
        await client.analyticsAggregator.start();
    }
}
