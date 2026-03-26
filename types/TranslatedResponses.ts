import {
    APIModalInteractionResponseCallbackData,
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    InteractionUpdateOptions,
    Message,
    MessageCreateOptions,
    MessageEditOptions,
} from 'discord.js';

export interface TranslatedResponses {
    replyTl(key: InteractionReplyOptions, ...placeholders: Object[]): Promise<Message | null>,

    editReplyTl(key: InteractionEditReplyOptions, ...placeholders: Object[]): Promise<Message | null>,

    followUpTl(key: InteractionReplyOptions, ...placeholders: Object[]): Promise<Message | null>,

    updateTl(key: InteractionUpdateOptions, ...placeholders: Object[]): Promise<Message | null>,

    sendTl(key: MessageCreateOptions, ...placeholders: Object[]): Promise<Message | null>,

    editTl(key: MessageEditOptions, ...placeholders: Object[]): Promise<Message | null>,

    showModalTl(key: APIModalInteractionResponseCallbackData, ...placeholders: Object[]): Promise<void>,
}
