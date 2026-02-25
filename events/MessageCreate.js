import Event from '../structures/Event.js';
import { addTranslatedResponses, ph } from '../utilities/messages.js';
import { cleanEmojis } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import { Events, MessageType } from 'discord.js';
import logger from '../utilities/logger.js';

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

    async execute(client, message) {
        if(message.author.bot) return;

        message = addTranslatedResponses(message);
        if(!message.inGuild()) {
            // Handle DM messages (verification codes)
            if(client.api.usersAwaitingVerification.has(message.content)) {
                const { username, uuid } = client.api.usersAwaitingVerification.get(message.content);
                const userConnection = await client.userConnections.connect({ id: message.author.id, username, uuid });

                await Promise.allSettled(client.serverConnections.cache.map(async conn => {
                    if(!conn.syncedRoles?.length) return;
                    try {
                        const guild = await client.guilds.fetch(conn.id);
                        const member = await guild.members.fetch(message.author.id);
                        await conn.syncRolesOfMember(member, userConnection);
                    }
                    catch(err) {
                        logger.debug(`Skipping role sync for server ${conn.id} of ${username}: ${err.message}`);
                    }
                }));

                client.api.usersAwaitingVerification.delete(message.content);
                return await message.replyTl(keys.commands.account.success.verified);
            }
        }

        const server = client.serverConnections.cache.get(message.guildId);
        if(!message.content.startsWith(client.config.prefix)) {
            // Relay chat messages to Minecraft server
            const channel = server?.chatChannels?.find(c => c.id === message.channel.id);
            if(!channel || channel.allowDiscordToMinecraft === false) return;
            let content = cleanEmojis(message.cleanContent);
            content += message.attachments.map(attach => `[${attach.name}](${attach.url})`).join(' ');
            const repliedMessage = message.type === MessageType.Reply ? await message.fetchReference() : null;
            let repliedContent = null;
            let repliedUser = null;
            if(repliedMessage) {
                repliedContent = cleanEmojis(repliedMessage.cleanContent);
                const attachmentsString = repliedMessage.attachments.map(attach => `[${attach.name}](${attach.url})`).join(' ');
                repliedContent = `${attachmentsString}\n${repliedContent}`;
                repliedUser = repliedMessage.member.displayName;
            }

            logger.debug({
                content,
                author: message.member.displayName,
                channel: message.channel.name,
                guild: message.guild.name,
            }, 'Relaying chat message to Minecraft server');
            void server.protocol.chat(content, message.member.displayName, repliedContent, repliedUser);
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
            await message.replyTl(keys.main.errors.could_not_execute_command, ph.error(err));
        }
    }
} 