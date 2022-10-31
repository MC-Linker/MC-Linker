import {
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessagePayload,
    MessageReplyOptions,
    WebhookEditMessageOptions,
} from 'discord.js';

const keysFile = require('../resources/languages/expanded/en_us.json');
export const keys = keysFile;

/*function initKeys(): typeof keysFile {
 const keys = addKeys(keysFile);

 function addKeys(obj, parentKey = null) {
 const keys = {};
 for(const key of Object.keys(obj)) {
 keys[key] = parentKey ? `${parentKey}.${key}` : key;
 }
 return keys;
 }

 const handler: ProxyHandler<any> = {
 get(target, name: string) {
 const value = _.get(keysFile, target[name]);
 return typeof value === 'string' ? value : new Proxy(addKeys(value, target[name]), handler);
 },
 };

 return new Proxy(keys, handler);
 }*/

export interface TranslatedResponses {
    replyTl(key: string, ...placeholders: Object[]): Promise<Message | InteractionResponse>,

    replyOptions(options: string | MessagePayload | InteractionReplyOptions | WebhookEditMessageOptions | MessageReplyOptions): Promise<Message | InteractionResponse>,
}
