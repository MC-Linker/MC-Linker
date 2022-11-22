import {
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessagePayload,
    MessageReplyOptions,
    WebhookEditMessageOptions,
} from 'discord.js';
import keysFile from '../resources/languages/expanded/en_us.json' assert { type: 'json' };

const keys = keysFile;

export interface TranslatedResponses {
    replyTl(key: string, ...placeholders: Object[]): Promise<Message | InteractionResponse>,

    replyOptions(options: string | MessagePayload | InteractionReplyOptions | WebhookEditMessageOptions | MessageReplyOptions): Promise<Message | InteractionResponse>,
}

export default keys;
