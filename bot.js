import MCLinker from './structures/MCLinker.js';
import logger from './utilities/logger.js';
import { uploadApplicationEmojis } from './utilities/utils.js';

logger.info(
    '\x1b[1m' +     // Bold (1)
    '\x1b[44;37m' + // Blue BG (44); White FG (37)
    '%s' +          // Insert second argument
    '\x1b[0m',      // Reset color (0)
    'Loading...',   // Second argument (%s)
);

// Handle errors
process.on('unhandledRejection', async err => {
    logger.fatal(err, 'Unhandled rejection');
});
process.on('uncaughtException', async err => {
    logger.fatal(err, 'Uncaught exception');
});

const client = new MCLinker();
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

if(!client.config.emojis) {
    client.config.emojis = await uploadApplicationEmojis(client);
    await client.writeConfig();
}

export default client;
