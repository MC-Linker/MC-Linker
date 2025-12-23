import { PermissionFlagsBits } from 'discord.js';
import WSEvent from '../../structures/api/WSEvent.js';

export default class GetInviteURL extends WSEvent {

    /**
     * @typedef {Object} GetInviteURLResponse
     * @property {?string} url - The invite URL, or null if one could not be created.
     */

    constructor() {
        super({
            event: 'invite-url',
        });
    }

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
            guild = await this.client.guilds.fetch(server.id);
            if(guild.vanityURLCode) return { url: `https://discord.gg/${guild.vanityURLCode}` };
            invites = await guild.invites.fetch();
        }
        catch(_) {}

        if(!guild) return { url: null };

        if(invites?.size) return { url: invites.first().url };
        else {
            /** @type {?import('discord.js').BaseGuildTextChannel} */
            const channel = guild.channels.cache.find(c =>
                c.isTextBased() && c.permissionsFor?.(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite),
            );
            if(!channel) return { url: null };

            const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
            return { url: invite.url };
        }
    }
}