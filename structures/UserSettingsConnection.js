import Connection from './Connection.js';
import Discord from 'discord.js';

export default class UserSettingsConnection extends Connection {

    /**
     * @typedef {object} UserSettingsConnectionData - The data for the user settings.
     * @property {OAuthTokens} tokens - The OAuth2 tokens for the user.
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
         * @type {OAuthTokens}
         */
        this.tokens ??= {};

        //Loop over tokens and assign them to the tokens object.
        if('tokens' in data) {
            if('accessToken' in data.tokens) this.tokens.accessToken = data.tokens.accessToken;
            if('refreshToken' in data.tokens) this.tokens.refreshToken = data.tokens.refreshToken;
            if('expires' in data.tokens) this.tokens.expires = data.tokens.expires;
        }
    }

    /**
     * Updates the user's role connections with the provided metadata.
     * @param {?string} username - The platform username of the user.
     * @param {object} metadata - The data to send to the Discord API.
     * @returns {Promise<boolean>} - True if the request was successful, false otherwise.
     */
    async updateRoleConnection(username, metadata) {
        await this._refreshToken();

        try {
            //TODO use client rest and use types
            const response = await fetch(`https://discord.com/api/v10/users/@me/applications/${process.env.CLIENT_ID}/role-connection`, {
                body: JSON.stringify({
                    platform_username: username,
                    platform_name: 'Minecraft',
                    metadata,
                }),
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${this.tokens.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if(!response.ok) {
                console.log(`Error updating role connection: [${response.status}] ${response.statusText}`);
                return false;
            }

            return true;
        }
        catch(err) {
            console.log(`Error updating role connections: ${err}`);
            return false;
        }
    }

    /**
     * Checks whether the access token has to be refreshed and refreshes it if necessary.
     * @returns {Promise<boolean>} - True if the token was refreshed, false otherwise.
     */
    async _refreshToken() {
        // Check if the access token has expired / is about to expire
        if(this.tokens.expires > Date.now() + 60 * 60 * 1000) {
            return false;
        }

        try {
            //TODO use client rest
            const response = await fetch(`https://discord.com/api/${Discord.Routes.oauth2TokenExchange()}`, {
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token: this.tokens.refreshToken,
                }),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if(!response.ok) {
                console.log(`Error refreshing access tokens: [${response.status}] ${response.statusText}`);
                return null;
            }

            const json = await response.json();
            await this.edit({
                tokens: {
                    accessToken: json.access_token,
                    refreshToken: json.refresh_token,
                    expires: Date.now() + json.expires_in * 1000,
                },
            });
            return true;
        }
        catch(err) {
            console.log(`Error refreshing access tokens: ${err}`);
            return null;
        }
    }

    /**
     * @inheritDoc
     */
    getData() {
        return {
            id: this.id,
            tokens: this.tokens,
        };
    }
}
