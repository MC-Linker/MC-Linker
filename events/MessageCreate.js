import Event from '../structures/Event.js';
import { addTranslatedResponses, ph } from '../utilities/messages.js';
import { cleanEmojis } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import { Events, MessageType } from 'discord.js';

/**
 * Handles the Discord messageCreate event for the MC-Linker bot.
 * Processes verification, command execution, and relays chat to Minecraft servers.
 */
export default class MessageCreate extends Event {
    constructor() {
        super({
            name: Events.MessageCreate,
        });
    }

    /**
     * @inheritdoc
     * @param client
     * @param {[import('discord.js').Message]} args - [0] The message.
     * @param logger
     */
    async run(client, [message], logger) {
        if(message.author.bot) return;

        message = addTranslatedResponses(message);
        if(!message.inGuild()) {
            // Handle DM messages (verification codes)
            if(client.api.usersAwaitingVerification.has(message.content)) {
                await client.serverConnections.syncRolesAcrossAllServers(message.author.id);

                client.api.usersAwaitingVerification.delete(message.content);
                return await message.replyTl(keys.commands.account.success.verified);
            }
        }

        const server = client.serverConnections.cache.get(message.guildId);
        if(server && !message.content.startsWith(client.config.prefix)) {
            // Relay chat messages to Minecraft server
            const channel = server.chatChannels.find(c => c.id === message.channel.id);
            if(!channel || channel.allowDiscordToMinecraft === false) return;
            let content = message.attachments.size ?
                `${message.attachments.map(attach => `[${attach.name}](${attach.url})`).join(' ')} \n${cleanEmojis(message.cleanContent)}` :
                cleanEmojis(message.cleanContent);

            const repliedMessage = message.type === MessageType.Reply ? await message.fetchReference() : null;
            let repliedContent = null;
            if(repliedMessage) {
                repliedContent = repliedMessage.attachments.size ?
                    `${repliedMessage.attachments.map(attach => `[${attach.name}](${attach.url})`).join(' ')} \n${cleanEmojis(repliedMessage.cleanContent)}` :
                    cleanEmojis(repliedMessage.cleanContent);
            }

            logger.debug({
                guildId: message.guildId,
                userId: message.author.id,
                content,
                author: message.member?.displayName ?? message.author.displayName,
                channel: message.channel.name,
                guild: message.guild.name,
            }, 'Relaying chat message to Minecraft server');
            void server.protocol.chat(content, message.member?.displayName ?? message.author.displayName, repliedContent, repliedMessage?.member?.displayName ?? repliedMessage?.author.displayName);
        }

        if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.replyTl(keys.main.success.ping);

        if(!message.content.startsWith(client.config.prefix) || message.author.bot) return;

        // Handle prefix command execution
        message.user = message.author;
        const args = message.content.slice(client.config.prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName);
        if(!command || !command.allowPrefix) return;
        try {
            await command.execute(message, client, args, server);
        }
        catch(err) {
            client.analytics.trackError('command', commandName, message.guildId, message.author.id, err, null, logger);
            await message.replyTl(keys.main.errors.could_not_execute_command, ph.error(err));
        }
    }
} 