import { ActionRowBuilder, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import WSEvent from '../WSEvent.js';
import keys from '../../utilities/keys.js';
import { addHyphen, cleanEmojis, handleProtocolResponse, UUIDRegex } from '../../utilities/utils.js';
import { addTranslatedResponses, getActionRows, getEmbed } from '../../utilities/messages.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';

/**
 * @typedef {Object} DmRequest
 * @property {string} player - The MC username or UUID of the sender.
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
     * Resolves the target identifier to a UserConnection.
     * Tries: MC username → MC UUID → Discord user ID → Discord username in guild.
     * @param {string} user - The target identifier.
     * @param {MCLinker} client - The MCLinker client.
     * @param {ServerConnection} server - The server connection.
     * @returns {Promise<?import('../../structures/connections/UserConnection.js').default>}
     */
    async resolveTarget(user, client, server) {
        // 1. MC username
        const byUsername = client.userConnections.cache.find(c => c.username.toLowerCase() === user.toLowerCase());
        if(byUsername) return byUsername;

        // 2. MC UUID
        if(UUIDRegex.test(user)) {
            const normalized = addHyphen(user);
            const byUUID = client.userConnections.cache.find(c => c.uuid === normalized);
            if(byUUID) return byUUID;
        }

        // 3. Discord user ID
        const byDiscordId = client.userConnections.cache.get(user);
        if(byDiscordId) return byDiscordId;

        // 4. Discord username within guild
        const guild = await client.guilds.fetch(server.id).catch(() => null);
        if(guild) {
            const members = await guild.members.search({ query: user, limit: 1 }).catch(() => null);
            if(members?.size) {
                const member = members.first();
                const byMember = client.userConnections.cache.get(member.id);
                if(byMember) return byMember;
            }
        }

        return null;
    }

    /**
     * @inheritdoc
     * @param {DmRequest} data - The request data.
     * @param server
     * @param client
     * @param logger
     */
    async run(data, server, client, logger) {
        const targetConnection = await this.resolveTarget(data.user, client, server);
        if(!targetConnection) return { status: 'error', error: ProtocolError.NOT_CONNECTED };

        const discordUser = await client.users.fetch(targetConnection.id).catch(() => null);
        if(!discordUser) return { status: 'error', error: ProtocolError.NOT_CONNECTED };

        const placeholders = { username: data.player, message: data.message };
        const embed = getEmbed(keys.api.plugin.success.dm, placeholders);
        const components = getActionRows(keys.api.plugin.success.dm, placeholders);

        let msg;
        try {
            msg = await discordUser.send({ embeds: [embed], components });
        }
        catch(err) {
            logger.warn({ userId: targetConnection.id }, 'Could not send DM (user may have DMs disabled)');
            return { status: 'error', error: 'dm_closed' };
        }

        // Collector for the Reply button
        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.customId === 'dm_reply' && i.user.id === targetConnection.id,
        });

        collector.on('collect', async btnInteraction => {
            const modal = new ModalBuilder()
                .setCustomId('dm_reply_modal')
                .setTitle(`Reply to ${data.player}`)
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('dm_reply_message')
                        .setLabel('Message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(256),
                ));
            await btnInteraction.showModal(modal);

            let modalInteraction;
            try {
                modalInteraction = await btnInteraction.awaitModalSubmit({
                    filter: i => i.user.id === btnInteraction.user.id && i.customId === 'dm_reply_modal',
                    time: 5 * 60 * 1000,
                });
            }
            catch {
                return; // User dismissed the modal
            }

            modalInteraction = addTranslatedResponses(modalInteraction);
            await modalInteraction.deferReply({ ephemeral: true });

            const srv = client.serverConnections.cache.get(server.id);
            if(!srv) {
                await modalInteraction.editReplyTl(keys.api.plugin.errors.dm_server_not_connected);
                return;
            }

            const replyMessage = cleanEmojis(modalInteraction.fields.getTextInputValue('dm_reply_message'));
            const resp = await srv.protocol.chatPrivate(replyMessage, modalInteraction.user.displayName, data.player);
            if(!await handleProtocolResponse(resp, srv.protocol, modalInteraction, {
                [ProtocolError.PLAYER_NOT_ONLINE]: keys.commands.message.warnings.player_not_online,
            }, { username: data.player })) return;

            const warning = resp.data === '' ? keys.api.plugin.warnings.no_response_message_short : '';
            await modalInteraction.editReplyTl(keys.commands.message.success, {
                username: data.player,
                message: replyMessage,
            }, { warning });
        });

        return { status: 'success' };
    }
}
