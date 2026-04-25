import Connection from './Connection.js';
import { Routes } from 'discord.js';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import { trackError } from '../analytics/AnalyticsCollector.js';

const logger = rootLogger.child({ feature: features.structures.connections.userSettings });

export default class UserSettingsConnection extends Connection {

    /**
     * @typedef {object} UserSettingsConnectionData - The data for the user settings.
     * @property {OAuthTokens} tokens - The OAuth2 tokens for the user.
     * @property {Object} dms - DM preferences for the user.
     * @property {boolean} dms.enabled - Whether DMs from Minecraft are enabled.
     * @property {string[]} dms.blockedServers - The IDs of the guilds whose MC servers are blocked from sending DMs.
     * @property {string[]} dms.blockedPlayers - The Minecraft usernames (case-insensitive) that are blocked from sending DMs.
     * @property {string} id - The id of the user the settings are connected to.
     */

    /**
     * @typedef {UserSettingsConnection|string} UserSettingsConnectionResolvable - Data that resolves to a UserSettingsConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the settings for.
     * @param {UserSettingsConnectionData|string} data - The data for the settings connection.
     * @param {CollectionName} collectionName - The name of the database collection that this connection is stored in.
     * @returns {UserSettingsConnection} - A new UserSettingsConnection instance.
     */
    constructor(client, data, collectionName = 'UserSettingsConnection') {
        super(client, data, collectionName);

        this._patch(data);
    }

    _patch(data) {

        /**
         * The id of the user the settings are connected to.
         * @type {string}
         */
        this.id = data.id ?? this.id;

        /**
         * The OAuth2 tokens for the user.
         * @type {UserSettingsConnectionData['tokens']}
         */
        this.tokens ??= {};

        if('tokens' in data) {
            if('accessToken' in data.tokens) this.tokens.accessToken = data.tokens.accessToken;
            if('refreshToken' in data.tokens) this.tokens.refreshToken = data.tokens.refreshToken;
            if('expires' in data.tokens) this.tokens.expires = data.tokens.expires;
        }

        /**
         * DM preferences for the user.
         * @type {UserSettingsConnectionData['dms']}
         */
        this.dms ??= { enabled: true, blockedServers: [], blockedPlayers: [] };

        if('dms' in data) {
            if('enabled' in data.dms) this.dms.enabled = data.dms.enabled;
            if('blockedServers' in data.dms) this.dms.blockedServers = data.dms.blockedServers;
            if('blockedPlayers' in data.dms) this.dms.blockedPlayers = data.dms.blockedPlayers;
        }
    }

    /**
     * Updates the user's role connections with the provided metadata.
     * @param {?string} username - The platform username of the user.
     * @param {object} metadata - The data to send to the Discord API.
     * @returns {Promise<boolean>} - True if the request was successful, false otherwise.
     */
    async updateRoleConnection(username, metadata) {
        if(!this.tokens.accessToken || !this.tokens.refreshToken || !this.tokens.expires) return false;

        await this._refreshToken();

        try {
            await this.client.rest.put(Routes.userApplicationRoleConnection(process.env.CLIENT_ID), {
                body: {
                    platform_username: username,
                    platform_name: 'Minecraft',
                    metadata,
                },
                auth: false, // Bots cannot use this endpoint, we set our own Authorization header
                headers: {
                    Authorization: `Bearer ${this.tokens.accessToken}`,
                },
            });

            return true;
        }
        catch(err) {
            trackError('unhandled', 'UserSettingsConnection', null, this.id, err, null, logger);
            return false;
        }
    }

    /**
     * Checks whether the access token has to be refreshed and refreshes it if necessary.
     * @returns {Promise<boolean>} - True if the token was refreshed, false otherwise.
     */
    async _refreshToken() {
        if(!this.tokens.accessToken || !this.tokens.refreshToken || !this.tokens.expires) return false;

        // Check if the access token has expired / is about to expire (less than 1 hour left)
        if(this.tokens.expires > Date.now() + 60 * 60 * 1000) {
            return false;
        }

        try {
            const response = await this.client.rest.post(Routes.oauth2TokenExchange(), {
                auth: false, // Bots cannot use this endpoint, we set our own Authorization header
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token: this.tokens.refreshToken,
                }).toString(),
                passThroughBody: true,
            });

            await this.edit({
                tokens: {
                    accessToken: response.access_token,
                    refreshToken: response.refresh_token,
                    expires: Date.now() + response.expires_in * 1000,
                },
            });
            return true;
        }
        catch(err) {
            trackError('unhandled', 'UserSettingsConnection', null, this.id, err, null, logger);
            return null;
        }
    }

    /**
     * Sets whether DMs from Minecraft are enabled for this user.
     * @param {boolean} enabled
     */
    setDmsEnabled(enabled) {
        this.dms.enabled = enabled;
    }

    /**
     * Blocks DMs from the given guild's MC server.
     * @param {string} guildId
     */
    blockServer(guildId) {
        this.dms.blockedServers.push(guildId);
    }

    /**
     * Unblocks DMs from the given guild's MC server.
     * @param {string} guildId
     */
    unblockServer(guildId) {
        this.dms.blockedServers = this.dms.blockedServers.filter(id => id !== guildId);
    }

    /**
     * Blocks DMs from the given Minecraft player.
     * @param {string} username - The Minecraft username (case-insensitive).
     */
    blockPlayer(username) {
        this.dms.blockedPlayers.push(username.toLowerCase());
    }

    /**
     * Unblocks DMs from the given Minecraft player.
     * @param {string} username - The Minecraft username (case-insensitive).
     */
    unblockPlayer(username) {
        this.dms.blockedPlayers = this.dms.blockedPlayers.filter(p => p !== username.toLowerCase());
    }

    getData() {
        return {
            id: this.id,
            tokens: this.tokens,
            dms: this.dms,
        };
    }
}
