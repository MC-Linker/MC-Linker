import Event from '../structures/Event.js';
import { addTranslatedResponses, ph } from '../utilities/messages.js';
import { cleanEmojis } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import ServerConnection from '../structures/ServerConnection.js';
import { Events } from 'discord.js';

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
                const promises = await Promise.allSettled(client.serverConnections.cache.map(async conn => {
                    if(!(conn instanceof ServerConnection)) return null;
                    if(!conn.syncedRoles || !conn.syncedRoles.length) return null;
                    try {
                        const guild = await client.guilds.fetch(conn.id);
                        const member = await guild.members.fetch(message.author.id);
                        return [conn, guild, member];
                    }
                    catch(err) { return null; }
                }));
                const arrayOfServers = promises.map(p => p.value).filter(p => p);
                for(const [conn, guild, member] of arrayOfServers) await conn.syncRoles(guild, member, userConnection);
                client.api.usersAwaitingVerification.delete(message.content);
                return await message.replyTl(keys.commands.account.success.verified);
            }
        }

        const server = client.serverConnections.cache.get(message.guildId);
        if(!message.content.startsWith(process.env.PREFIX)) {
            // Relay chat messages to Minecraft server
            const channel = server?.chatChannels?.find(c => c.id === message.channel.id);
            if(!channel || channel.allowDiscordToMinecraft === false) return;
            let content = cleanEmojis(message.cleanContent);
            message.attachments?.forEach(attach => content += ` \n [${attach.name}](${attach.url})`);
            const repliedMessage = message.type === 19 ? await message.fetchReference() : null;
            let repliedContent = repliedMessage ? cleanEmojis(repliedMessage.cleanContent) : null;
            if(repliedContent?.length === 0 && repliedMessage.attachments.size !== 0) {
                const firstAttach = repliedMessage.attachments.first();
                repliedContent = `[${firstAttach.name}](${firstAttach.url})`;
            }
            const repliedUser = repliedMessage ? repliedMessage.member?.nickname ?? repliedMessage.author.username : null;
            server.protocol.chat(content, message.member?.nickname ?? message.author.username, repliedContent, repliedUser);
        }

        if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.replyTl(keys.main.success.ping);

        if(!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;
        if(!message.inGuild()) return message.replyTl(keys.main.no_access.not_in_guild);

        // Handle prefix command execution
        message.user = message.author;
        const args = message.content.slice(process.env.PREFIX.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName);
        if(!command || !command.allowPrefix) return;
        try {
            await command.execute(message, client, args, server);
        }
        catch(err) {
            await message.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(message));
        }
    }
} 