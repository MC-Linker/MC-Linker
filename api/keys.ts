import {
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessagePayload,
    MessageReplyOptions,
    WebhookEditMessageOptions,
} from 'discord.js';
import keys from '../resources/languages/expanded/en_us.json' assert { type: 'json' };

export default keys;

export interface TranslatedResponses {
    replyTl(key: string, ...placeholders: Object[]): Promise<Message | InteractionResponse>,

    replyOptions(options: string | MessagePayload | InteractionReplyOptions | WebhookEditMessageOptions | MessageReplyOptions): Promise<Message | InteractionResponse>,
}