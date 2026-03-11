import { getChatWebhookIdentity } from './ChatConstants.js';

/**
 * Returns options used for system-style webhook messages in chat channels.
 * @param {import('discord.js').TextChannel} discordChannel - The destination channel.
 * @returns {{ username: string, avatarURL: string, threadId?: string }}
 */
export function getSystemWebhookSendOptions(discordChannel) {
    return {
        ...getChatWebhookIdentity(),
        ...(discordChannel.isThread() ? { threadId: discordChannel.id } : {}),
    };
}

/**
 * Builds a webhook payload for chat messages, combining consecutive messages from the same player
 * into one message with line breaks, up to Discord's 2000-character limit.
 * @param {import('./ChatQueueProcessor.js').ChatQueueItem[]} items - The queued chat items (only leading items from the same player are consumed).
 * @returns {{ consumed: number, content: string, username: string, avatarURL: ?string }}
 */
export function buildChatPayload(items) {
    const first = items[0];
    const playerName = first.player || 'Minecraft';

    let consumed = 0;
    let content = '';
    for(const item of items) {
        if(item.kind !== 'chat') break;
        if((item.player || 'Minecraft') !== playerName) break;

        const nextLine = item.message || '';
        const nextContent = content ? `${content}\n${nextLine}` : nextLine;
        if(nextContent.length > 2000 && consumed > 0) break;

        // Single message over 2000
        content = nextContent.length > 2000 ? `${nextContent.slice(0, 1999)}…` : nextContent;
        consumed++;
    }

    return {
        consumed,
        content,
        username: playerName,
        avatarURL: first.authorURL,
    };
}

/**
 * Builds a batch-mode payload for chat messages, formatting each as `**Player**: message` markdown.
 * Messages from different players are combined into a single content string up to Discord's 2000-character limit.
 * @param {import('./ChatQueueProcessor.js').ChatQueueItem[]} items - The queued chat items to batch.
 * @returns {{ consumed: number, content: string }}
 */
export function buildChatBatchPayload(items) {
    let consumed = 0;
    let content = '';

    for(const item of items) {
        if(item.kind !== 'chat') break;

        const name = item.player || 'Minecraft';
        // Make each message single-line
        const text = (item.message || '').replace(/\n+/g, ' ').trim();
        const line = `**${name}**: ${text}`;
        const nextContent = content ? `${content}\n${line}` : line;

        if(nextContent.length > 2000 && consumed > 0) break;

        // Single message over 2000
        content = nextContent.length > 2000 ? `${nextContent.slice(0, 1999)}…` : nextContent;
        consumed++;
    }

    return { consumed, content };
}
