import { InteractionReplyOptions, Message, MessagePayload, MessageReplyOptions } from 'discord.js';

export interface TranslatedResponses {
    replyTl(key: string, ...placeholders: Object[]): Promise<Message>,

    replyOptions(options: string | MessagePayload | InteractionReplyOptions | MessageReplyOptions): Promise<Message>,
}
