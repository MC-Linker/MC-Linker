import { RESTJSONErrorCodes } from 'discord.js';
import WSEvent from '../WSEvent.js';
import keys from '../../utilities/keys.js';
import {
    cleanEmojis,
    DefaultCollectorTimeout,
    findMemberByUsername,
    MaxMessageContentLength,
    UUIDRegex,
} from '../../utilities/utils.js';
import { addTranslatedResponses, getReplyOptions } from '../../utilities/messages.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';

/**
 * @typedef {Object} DmRequest
 * @property {string} player - The MC username of the sender.
 * @property {string} user - The target identifier (MC username, MC UUID, Discord user ID, or Discord username).
 * @property {string} message - The message content.
 */

export default class Dm extends WSEvent {

    constructor() {
        super({
            event: 'dm',
        });
    }

    /**
     * Returns whether a Discord fetch error simply means "not found/invalid input".
     * @param {Error & { code?: number|string }} err
     * @returns {boolean}
     */
    static isLookupMiss(err) {
        return err?.code === RESTJSONErrorCodes.UnknownUser
            || err?.code === RESTJSONErrorCodes.UnknownMember
            || err?.code === RESTJSONErrorCodes.InvalidFormBodyOrContentType;
    }

    /**
     * Resolves a target identifier to a Discord user ID.
     * Tries in order: MC UUID → MC username → Discord snowflake ID → Discord username.
     * Returns `null` when the target cannot be found or is not linked to any Discord account.
     * Throws on unexpected API errors (after tracking them).
     * @param {string} target - The target identifier.
     * @param {MCLinker} client
     * @param {ServerConnection} server
     * @param {import('pino').Logger} logger
     * @returns {Promise<string|null>} Discord user ID, or null if not found.
     */
    async resolveToDiscordId(target, client, server, logger) {
        // 1. MC UUID
        if(UUIDRegex.test(target)) {
            const conn = client.userConnections.findByUUID(target, server);
            return conn?.id ?? null;
        }

        // 2. MC username
        const byMcUsername = client.userConnections.cache.find(c => c.username.toLowerCase() === target.toLowerCase());
        if(byMcUsername) return byMcUsername.id;

        // 3. Discord snowflake ID
        if(/^\d{17,20}$/.test(target)) return target;

        // 4. Discord username in guild
        try {
            const guild = await client.guilds.fetch(server.id);
            const member = await findMemberByUsername(guild, target);
            return member?.user.id ?? null;
        }
        catch(err) {
            if(Dm.isLookupMiss(err)) return null;
            client.analytics.trackError('api_ws', 'dm', server.id, null, err, {
                stage: 'discord_username',
                target,
            }, logger);
            throw err;
        }
    }

    /**
     * @inheritdoc
     * @param {DmRequest} data
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        let discordId;
        try {
            discordId = await this.resolveToDiscordId(data.user, client, server, logger);
            if(discordId === null) return { status: 'error', error: ProtocolError.NOT_FOUND };
        }
        catch {
            return { status: 'error', error: ProtocolError.UNKNOWN };
        }

        let member;
        try {
            const guild = await client.guilds.fetch(server.id);
            member = await guild.members.fetch(discordId);
        }
        catch(err) {
            if(Dm.isLookupMiss(err)) return { status: 'error', error: ProtocolError.NOT_FOUND };
            client.analytics.trackError('api_ws', 'dm', server.id, null, err, {
                stage: 'fetch_user',
                target: discordId,
            }, logger);
            return { status: 'error', error: ProtocolError.UNKNOWN };
        }

        // Truncate message to TextDisplay limit, appending … if needed
        const message = data.message.length < MaxMessageContentLength
            ? data.message
            : data.message.slice(0, MaxMessageContentLength - 1) + '…';

        let msg;
        try {
            msg = await member.send(getReplyOptions(keys.api.plugin.success.dm.message, {
                username: data.player,
                message,
                ip: server.displayIp,
                footer: keys.api.plugin.success.dm.footer,
            }));
        }
        catch(err) {
            logger.warn({ userId: member.id }, 'Could not send DM (user may have DMs disabled)');
            return { status: 'error', error: ProtocolError.DM_CLOSED };
        }

        // Collector for replies to the DM message
        const collector = msg.channel.createMessageCollector({
            filter: m => m.reference?.messageId === msg.id && m.author.id === member.id,
            time: DefaultCollectorTimeout,
        });

        msg = addTranslatedResponses(msg);
        collector.on('collect', async m => {
            const replyMessage = cleanEmojis(m.content);
            if(!replyMessage) return;

            const currentServer = client.serverConnections.cache.get(data.serverId ?? server.id);
            if(!currentServer) return await msg.sendTl(keys.api.plugin.errors.dm_server_not_connected);

            const resp = await currentServer.protocol.chatPrivate(replyMessage, m.author.displayName, data.player);
            if(resp?.error === ProtocolError.PLAYER_NOT_ONLINE) return await msg.sendTl(keys.commands.message.warnings.player_not_online, { username: data.player });
        });

        collector.on('end', async () => {
            await msg.editTl(keys.api.plugin.success.dm.message, {
                username: data.player,
                message,
                ip: server.displayIp,
                footer: keys.api.plugin.success.dm.footer_expired,
            });
        });

        return { status: 'success' };
    }
}
