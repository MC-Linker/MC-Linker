export const CHAT_WEBHOOK_NAME = 'MC Linker Chat';
export const CHAT_WEBHOOK_AVATAR_URL = 'https://mclinker.com/logo.png';
export const CHAT_WEBHOOK_LEGACY_NAMES = new Set(['MC Linker', 'ChatChannel']);
export const DISPATCH_HIGH_LOAD_ENTER_THRESHOLD = 500;
export const DISPATCH_HIGH_LOAD_EXIT_THRESHOLD = 200;
export const DISPATCH_HIGH_LOAD_SUMMARY_INTERVAL_MS = 10_000;
export const RATE_LIMITER_POINTS = 4;
export const RATE_LIMITER_DURATION = 2;
export const MAX_WEBHOOKS_PER_CHANNEL = 15;
export const IDLE_WEBHOOK_PRUNE_COOLDOWN_MS = 60_000;
export const PRUNE_CHECK_INTERVAL_MS = 30_000;
export const WEBHOOK_TOKEN_REFRESH_TTL_MS = 14 * 60_000;
export const CONSOLE_AFFINITY_HEADROOM = 150;

/**
 * Returns the default webhook identity used for chat-channel webhook messages.
 * @returns {import('discord.js').WebhookMessageCreateOptions['username'|'avatarURL']}
 */
export function getChatWebhookIdentity() {
    return {
        username: CHAT_WEBHOOK_NAME,
        avatarURL: CHAT_WEBHOOK_AVATAR_URL,
    };
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
