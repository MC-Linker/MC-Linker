import {
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessagePayload,
    MessageReplyOptions,
    WebhookEditMessageOptions,
} from 'discord.js';

export interface TranslatedResponses {
    replyTl(key: string, ...placeholders: Object[]): Promise<Message | InteractionResponse>,

    replyOptions(options: string | MessagePayload | InteractionReplyOptions | WebhookEditMessageOptions | MessageReplyOptions): Promise<Message | InteractionResponse>,
}
