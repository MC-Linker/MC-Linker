import { ComponentType, RESTJSONErrorCodes } from 'discord.js';
import WSEvent from '../WSEvent.js';
import keys from '../../utilities/keys.js';
import {
    cleanEmojis,
    findMemberByUsername,
    handleProtocolResponse,
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
        return err?.code === RESTJSONErrorCodes.UnknownUser || err?.code === RESTJSONErrorCodes.InvalidFormBodyOrContentType;
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

        let discordUser;
        try {
            discordUser = await client.users.fetch(discordId);
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
            msg = await discordUser.send(getReplyOptions(keys.api.plugin.success.dm, {
                username: data.player,
                message,
                ip: server.displayIp,
            }));
        }
        catch(err) {
            logger.warn({ userId: discordUser.id }, 'Could not send DM (user may have DMs disabled)');
            return { status: 'error', error: ProtocolError.DM_CLOSED };
        }

        // Collector for the Reply button
        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.customId === 'dm_reply' && i.user.id === discordUser.id,
        });

        collector.on('collect', async btnInteraction => {
            btnInteraction = addTranslatedResponses(btnInteraction);
            await btnInteraction.showModalTl(keys.api.plugin.success.dm.reply_modal, { username: data.player });

            let modalInteraction;
            try {
                modalInteraction = await btnInteraction.awaitModalSubmit({
                    filter: i => i.customId === 'dm_reply_modal' && i.user.id === btnInteraction.user.id,
                    time: 5 * 60 * 1000,
                });
            }
            catch {
                return; // User dismissed the modal
            }

            modalInteraction = addTranslatedResponses(modalInteraction);
            await modalInteraction.deferReply({ ephemeral: true });

            const currentServer = client.serverConnections.cache.get(data.serverId ?? server.id);
            if(!currentServer) {
                await modalInteraction.editReplyTl(keys.api.plugin.errors.dm_server_not_connected);
                return;
            }

            const replyMessage = cleanEmojis(modalInteraction.fields.getTextInputValue('dm_reply_message'));
            const resp = await currentServer.protocol.chatPrivate(replyMessage, modalInteraction.user.displayName, data.player);
            if(!await handleProtocolResponse(resp, currentServer.protocol, modalInteraction, {
                [ProtocolError.PLAYER_NOT_ONLINE]: keys.commands.message.warnings.player_not_online,
            }, { username: data.player })) return;

            await modalInteraction.editReplyTl(keys.commands.message.success, {
                username: data.player,
                message: replyMessage,
            });
        });

        return { status: 'success' };
    }
}
