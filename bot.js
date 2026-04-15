import MCLinker from './structures/MCLinker.js';
import rootLogger from './utilities/logger/Logger.js';
import features from './utilities/logger/features.js';
import { uploadApplicationEmojis } from './utilities/utils.js';

const logger = rootLogger.child({ feature: features.core.bot });

logger.info(
    '\x1b[1m' +     // Bold (1)
    '\x1b[44;37m' + // Blue BG (44); White FG (37)
    '%s' +          // Insert second argument
    '\x1b[0m',      // Reset color (0)
    'Loading...',   // Second argument (%s)
);

// Handle errors
// Flush analytics on graceful shutdown (covers Docker stop / CTRL+C)
async function shutdown() {
    try { await client?.analyticsAggregator?.destroy(); }
    catch(err) { logger.error(err, 'Failed to destroy analytics aggregator during shutdown'); }
    try { await client?.analytics?.destroy(); }
    catch(err) { logger.error(err, 'Failed to destroy analytics during shutdown'); }
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', async err => {
    logger.fatal(err, 'Unhandled rejection');
    try { client?.analytics?.trackError('unhandled', 'unhandledRejection', null, null, err, null, logger); }
    catch { /* client not yet initialized */ }
});
process.on('uncaughtException', async err => {
    logger.fatal(err, 'Uncaught exception');
    try { client?.analytics?.trackError('unhandled', 'uncaughtException', null, null, err, null, logger); }
    catch { /* client not yet initialized */ }
});

const config = await MCLinker.loadConfig();
logger.debug(`Loaded configuration.`);

if(config.initialDebugFilters) rootLogger.applyInitialDebugFilters(config.initialDebugFilters);

const client = new MCLinker(config);
await client.loadEverything();

await client.login(process.env.TOKEN);

if(client.shard.ids.includes(0)) {
    client.config.emojis = await uploadApplicationEmojis(client);
    await MCLinker.writeConfig(client.config);
}

export default client;
