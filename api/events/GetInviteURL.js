import { PermissionFlagsBits } from 'discord.js';
import WSEvent from '../WSEvent.js';
import logger from '../../utilities/logger.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';

export default class GetInviteURL extends WSEvent {

    constructor() {
        super({
            event: 'invite-url',
        });
    }

    /**
     * @typedef {Object} GetInviteURLResponse
     * @property {'success'|'error'} status - The status of the response.
     * @property {string} [error] - The error code.
     * @property {{ url: string }} [data] - The response data containing the invite URL.
     */

    /**
     * Returns an existing invite url or creates a new one if none exists.
     * @param {{}} data - The data sent with the request.
     * @param {ServerConnection} server - The server the request is sent for.
     * @param {MCLinker} client - The client the request is sent to.
     * @returns {GetInviteURLResponse}
     */
    async execute(data, server, client) {
        let invites;
        let guild;
        try {
            guild = await client.guilds.fetch(server.id);
            if(guild.vanityURLCode) return {
                status: 'success',
                data: { url: `https://discord.gg/${guild.vanityURLCode}` },
            };
            invites = await guild.invites.fetch();
        }
        catch(err) {
            logger.debug(`Failed to fetch invites for guild ${server.id} in GetInviteURL`, err);
        }

        if(!guild) return { status: 'error', error: ProtocolError.NOT_FOUND };

        if(invites?.size) return { status: 'success', data: { url: invites.first().url } };
        else {
            /** @type {?import('discord.js').BaseGuildTextChannel} */
            const channel = guild.channels.cache.find(c =>
                c.isTextBased() && c.permissionsFor?.(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite),
            );
            if(!channel) return { status: 'error', error: ProtocolError.NOT_FOUND };

            const invite = await channel.createInvite({
                maxAge: 0,
                maxUses: 0,
                unique: false,
                reason: 'Invite URL requested by Minecraft',
            });
            return { status: 'success', data: { url: invite.url } };
        }
    }
}