import { PermissionFlagsBits } from 'discord.js';
import WSEvent from '../WSEvent.js';
import rootLogger from '../../utilities/logger.js';
import features from '../../utilities/logFeatures.js';
import { ProtocolError } from '../../structures/protocol/Protocol.js';

const logger = rootLogger.child({ feature: features.api.socketio.getInviteUrl });

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
        let guild;
        try {
            guild = await client.guilds.fetch(server.id);
            if(guild.vanityURLCode) return {
                status: 'success',
                data: { url: `https://discord.gg/${guild.vanityURLCode}` },
            };
            await guild.invites.fetch();
        }
        catch(err) {
            logger.debug(err, `Failed to fetch invites for guild ${server.id}`);
        }

        if(!guild) return { status: 'error', error: ProtocolError.NOT_FOUND };

        if(guild.invites.cache.size) {
            let invite = guild.invites.cache.find(i => i.maxUses === 0 && i.maxAge === 0);
            if(!invite) invite = guild.invites.cache.find(i => i.maxUses === 0);
            if(!invite) invite = guild.invites.cache.find(i => i.maxAge === 0);
            if(!invite) invite = guild.invites.cache.first();
            if(invite) return { status: 'success', data: { url: invite.url } };
        }

        try {
            await guild.channels.fetch(); // cache channels
        }
        catch(err) {
            logger.debug(err, `Failed to fetch channels for guild ${server.id}`);
        }

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