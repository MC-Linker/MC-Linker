import {
    BaseInteraction,
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessagePayload,
    MessageReplyOptions,
    WebhookEditMessageOptions,
} from 'discord.js';
import { replyOptions, replyTl } from './messages';

export const keys = require('../resources/languages/expanded/en_us.json');

interface TranslatedResponses {
    replyTl?(key: string, ...placeholders: Object[]): Promise<Message | InteractionResponse>,

    replyOptions?(options: string | MessagePayload | InteractionReplyOptions | WebhookEditMessageOptions | MessageReplyOptions): Promise<Message | InteractionResponse>,
}

export function addTranslatedResponses<I extends BaseInteraction | Message>(interaction: I & TranslatedResponses): I & TranslatedResponses {
    interaction.replyTl = (key, ...placeholders) => replyTl(interaction, key, ...placeholders);
    interaction.replyOptions = options => replyOptions(interaction, options);
    return interaction;
}
