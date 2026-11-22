export const CHAT_WEBHOOK_NAME = 'MC Linker Chat';
export const CHAT_WEBHOOK_AVATAR_URL = 'https://mclinker.com/logo.png';
export const CHAT_WEBHOOK_LEGACY_NAMES = new Set(['MC Linker', 'ChatChannel']);
export const DISPATCH_HIGH_LOAD_ENTER_THRESHOLD = 50;
export const DISPATCH_HIGH_LOAD_EXIT_THRESHOLD = 25;
export const DISPATCH_HIGH_LOAD_SUMMARY_INTERVAL_MS = 10_000;
export const MAX_WEBHOOKS_PER_CHANNEL = 15;
export const IDLE_WEBHOOK_PRUNE_COOLDOWN_MS = 60_000;
export const PRUNE_CHECK_INTERVAL_MS = 30_000;
export const WEBHOOK_TOKEN_REFRESH_TTL_MS = 14 * 60_000;
export const CONSOLE_AFFINITY_HEADROOM = 150;
export const CREATION_FAILURE_COOLDOWN_MS = 5 * 60_000;

/**
 * Discord rejects webhook usernames containing these substrings (400 Invalid Form Body).
 * @type {RegExp}
 */
const FORBIDDEN_WEBHOOK_USERNAME = /discord|clyde/i;

/**
 * Returns the webhook identity used for system-style chat-channel webhook messages.
 * Uses the bot's per-guild profile (nickname/avatar set via /customize) when available.
 * The bot's own guild member is kept in discord.js's member cache from GUILD_CREATE and updated
 * through GUILD_MEMBER_UPDATE (GuildMembers intent), so no extra fetching or TTL is needed.
 * Each field falls back independently to the global profile: the custom bot's own user for
 * custom bots, otherwise the MC Linker default name and logo.
 * @param {?import('discord.js').Guild} [guild] - The guild the message is sent in.
 * @returns {{ username: string, avatarURL: string }}
 */
export function getChatWebhookIdentity(guild) {
    const client = guild?.client;
    const globalUser = client?.isCustomBot?.() ? client.user : null;

    let username = CHAT_WEBHOOK_NAME;
    let avatarURL = CHAT_WEBHOOK_AVATAR_URL;
    if(globalUser) {
        if(isValidWebhookUsername(globalUser.displayName)) username = globalUser.displayName;
        avatarURL = globalUser.displayAvatarURL({ extension: 'png', size: 256 });
    }

    const me = guild?.members?.me;
    if(me?.nickname && isValidWebhookUsername(me.nickname)) username = me.nickname;
    if(me?.avatar) avatarURL = me.avatarURL({ extension: 'png', size: 256 });

    return { username, avatarURL };
}

/**
 * Checks whether a name can be used as a webhook message username.
 * @param {?string} name - The name to check.
 * @returns {boolean}
 */
function isValidWebhookUsername(name) {
    return typeof name === 'string' && name.trim().length > 0 && name.length <= 80 && !FORBIDDEN_WEBHOOK_USERNAME.test(name);
}

/**
 * Returns the default webhook creation options for chat channels.
 * @returns {import('discord.js').ChannelWebhookCreateOptions}
 */
export function getChatWebhookCreationOptions() {
    return {
        name: CHAT_WEBHOOK_NAME,
        reason: 'ChatChannel to Minecraft',
        avatar: CHAT_WEBHOOK_AVATAR_URL,
    };
}
