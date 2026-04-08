import MCLinker from './structures/MCLinker.js';
import rootLogger from './utilities/logger/logger.js';
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
    try { await client?.analytics?.destroy(); }
    catch {}
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

/*
 * Converts the first letter of a string to uppercase.
 * @param {boolean} c - True for snake_case, false for camelCase.
 * @param {boolean} n - Whether to add a space before numbers.
 * @returns {String} - The formatted string.
 */
String.prototype.toTitleCase = function(c, n) {
    let t;
    if(c) t = this.replace(/\s/g, '').replace(n ? /([A-Z])/g : /([A-Z0-9])/g, ' $1').replace(/[_-]/g, ' ');
    else t = this;
    return t.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).trim();
};

await client.login(process.env.TOKEN);

if(client.shard.ids.includes(0)) {
    client.config.emojis = await uploadApplicationEmojis(client);
    await MCLinker.writeConfig(client.config);
}

export default client;
