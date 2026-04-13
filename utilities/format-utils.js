import Discord from 'discord.js';
import emoji from 'emojione';

export const CODE_BLOCK_OVERHEAD_ANSI = 12; // ```ansi\n\n```
export const CODE_BLOCK_OVERHEAD_PLAIN = 8; // ```\n\n```
//TODO put in discord-constants.js
export const MaxEmbedDescriptionLength = 4096;

/**
 * Removes all minecraft color codes from a string.
 * @param {string} text - The text to remove color codes from.
 * @returns {string} - The text without color codes.
 */
export function stripColorCodes(text) {
    return text.replace(/[&§]([0-9a-fk-or])/gi, '');
}

/**
 * Removes all ansi codes from a string.
 * @param {string} text - The text to remove ansi codes from.
 * @returns {string} - The text without ansi codes.
 */
export function stripAnsiCodes(text) {
    return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Checks whether a string contains any ANSI escape codes.
 * @param {string} text - The text to check.
 * @returns {boolean} - Whether the text contains ANSI codes.
 */
export function containsAnsiCodes(text) {
    return /\u001b\[[0-9;]*m/.test(text);
}

const colorCodesToAnsi = {
    '4': '31', //Red
    'c': '31', //Red
    '6': '33', //Yellow
    'e': '33', //Yellow
    '2': '32', //Green
    'a': '32', //Green
    'b': '36', //Cyan
    '3': '36', //Cyan
    '1': '34', //Blue
    '9': '34', //Blue
    'd': '35', //Magenta
    '5': '35', //Magenta
    'f': '37', //White
    '7': '37', //White
    '0': '30', //Black
    '8': '30', //Black
};

const formattingCodesToAnsi = {
    'l': '1', //Bold
    'n': '4', //Underline
    'r': '0', //Reset
};

/**
 * Matches both \"§aGreen Text\" and §aGreenText, capturing the color code and the text separately.
 */
const colorPattern = /(?<=["'])[&§]([0-9a-fk-or])(?:[&§]([0-9a-fk-or]))?([^'"§&]+)(?=["'])|[&§]([0-9a-fk-or])(?:[&§]([0-9a-fk-or]))?([^&§":,]+)/gi;

/**
 * Wraps a string in a discord code block with the ansi language for color formatting.
 * If the string is too long, it will be truncated and an ellipsis will be added at the end.
 * If the string contains more than 1000 characters, all ansi codes will be stripped (discord won't parse them).
 * @param {string} text - The text to wrap in a code block.
 * @returns {`\`\`\`ansi\n${string}\n\`\`\``|`\`\`\`\n${string}\n\`\`\``}
 */
export function toAnsiCodeBlock(text) {
    text = text.replace(/\u001b\[m/g, '\u001b[0m'); // Discord things
    let hasAnsi = containsAnsiCodes(text);
    // Ansi formatting vanishes with more than 1000 characters ¯\_(ツ)_/¯
    if(hasAnsi && text.length >= 1000 - CODE_BLOCK_OVERHEAD_ANSI) {
        text = stripAnsiCodes(text);
        hasAnsi = false;
    }

    // -12 for code block (```ansi\n\n```)
    if(text.length > MaxEmbedDescriptionLength - CODE_BLOCK_OVERHEAD_ANSI) text = `${text.substring(0, MaxEmbedDescriptionLength - 13)}…`;

    //Wrap in discord code block for color
    return Discord.codeBlock(hasAnsi ? 'ansi' : '', text);
}

/**
 * Creates a discord code block from a minecraft command response (with colors codes using ansi).
 * @param {string} response - The command response.
 * @returns {`\`\`\`ansi\n${string}\n\`\`\``}
 */
export function codeBlockFromCommandResponse(response) {
    //Parse color codes to ansi
    let parsedResponse = response.replace(colorPattern, (_, color1, format1, word1, color2, format2, word2) => {
        const color = color1 ?? color2;
        const format = format1 ?? format2;
        const ansiColor = colorCodesToAnsi[color] ?? formattingCodesToAnsi[color];
        const ansiFormat = colorCodesToAnsi[format] ?? formattingCodesToAnsi[format];
        if(!ansiColor && !ansiFormat) return '';

        // Reset after every word
        return `\u001b[${ansiFormat ?? '0'};${ansiColor ?? '37'}m${word1 ?? word2 ?? ''}\u001b[0m`;
    });

    return toAnsiCodeBlock(parsedResponse);
}

/**
 * Converts custom discord emojis and unicode emojis to their string representation.
 * @example
 * // returns "Hello :smile:"
 * cleanEmojis('Hello 😀');
 * @param {string} message - The message to clean
 * @returns {string} - The cleaned message.
 */
export function cleanEmojis(message) {
    const cleanedMessage = emoji.toShort(message);
    return cleanedMessage.replace(/<a?(:[a-zA-Z0-9_]+:)[0-9]+>/g, '$1');
}

/**
 * Formats a duration in milliseconds to a string.
 * @param {Number} milliseconds - The duration in milliseconds.
 * @returns {String} - The formatted duration.
 * @example 1000 -> "1s"
 * @example 6006000600 -> "1h 40m 6s"
 */
export function formatDuration(milliseconds) {
    let seconds = milliseconds / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    // Round values and get remainder
    seconds = Math.floor(seconds) % 60;
    minutes = Math.floor(minutes) % 60;
    hours = Math.floor(hours) % 24;
    days = Math.floor(days);

    return `${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes ? `${minutes}m ` : ''}${seconds}s`;
}

/**
 * Formats a distance in centimeters to a string.
 * @param {Number} centimeters - The distance in centimeters.
 * @returns {String} - The formatted distance.
 * @example 1000 -> "1m"
 * @example 1234567 -> "1km 234m 567cm"
 */
export function formatDistance(centimeters) {
    let meters = centimeters / 100;
    let kilometers = meters / 1000;

    // Round values and get remainder
    meters = Math.floor(meters) % 1000;
    kilometers = Math.floor(kilometers);

    return `${kilometers ? `${kilometers}km ` : ''}${meters ? `${meters}m ` : ''}${centimeters % 100}cm`;
}

/**
 * Formats a duration in milliseconds to a string.
 * @param {Number} ms - The duration in milliseconds.
 * @returns {String} - The formatted duration.
 * @example 1000 -> "1 second"
 * @example 1000000 -> "16 minutes, 40 seconds"
 * @example 1000000000 -> "11 days, 13 hours, 46 minutes, 40 seconds"
 */
export function durationString(ms) {
    if(Number.isNaN(ms)) return 'Invalid duration';
    let seconds = ms / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;
    let weeks = days / 7;
    let years = days / 365.25; // .25 for leap years

    // Round values and get remainder
    seconds = Math.round(seconds) % 60;
    minutes = Math.round(minutes) % 60;
    hours = Math.round(hours) % 24;
    days = Math.round(days) % 7;
    weeks = Math.round(weeks) % 52;
    years = Math.round(years);

    return `${years} year${years === 1 ? '' : 's'}, ${weeks} week${weeks === 1 ? '' : 's'}, ${days} day${days === 1 ? '' : 's'}, ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        //Remove 0 values
        .replace(/(?<!\d)0\s[a-z]+,\s/g, '').replace(/(, 00:00:00)/, '');
}

/**
 * Converts a string to title case.
 * @param {string} str - The string to convert.
 * @param {boolean} [snakeCase=false] - Whether to split on camelCase/snake_case boundaries.
 * @param {boolean} [noNumberSpace=false] - Whether to avoid splitting before numbers.
 * @returns {string} - The formatted string.
 */
export function toTitleCase(str, snakeCase = false, noNumberSpace = false) {
    let t;
    if(snakeCase) t = str.replace(/\s/g, '').replace(noNumberSpace ? /([A-Z])/g : /([A-Z0-9])/g, ' $1').replace(/[_-]/g, ' ');
    else t = str;
    return t.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).trim();
}
