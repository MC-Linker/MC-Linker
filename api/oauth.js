import Discord from 'discord.js';
import crypto from 'crypto';

/**
 * @typedef {object} OAuthTokens
 * @property {string} accessToken - The access token to use for API requests
 * @property {string} refreshToken - The refresh token to use to get a new access token
 * @property {number} expires - The time at which the access token expires
 */

/**
 * Generate the url which the user will be directed to in order to approve the bot, and see the list of requested scopes.
 * @returns {{state: string, url: string}} - The state and url to redirect the user to.
 */
export function getOAuthURL() {
    const state = crypto.randomUUID();

    const url = new URL(`https://discord.com/api/${Discord.Routes.oauth2Authorization()}`);
    url.searchParams.set('client_id', process.env.CLIENT_ID);
    url.searchParams.set('redirect_uri', process.env.LINKED_ROLES_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'role_connections.write identify');
    url.searchParams.set('prompt', 'consent');
    return { state, url: url.toString() };
}

/**
 * Gets a user access token from the Discord API using the provided authorization code.
 * @param {string} code - The authorization code.
 * @returns {Promise<?OAuthTokens>} - The OAuth tokens or null if the request failed.
 */
export async function getTokens(code) {
    try {
        const response = await fetch(`https://discord.com/api/${Discord.Routes.oauth2TokenExchange()}`, {
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: process.env.LINKED_ROLES_REDIRECT_URI,
                code,
            }),
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if(!response.ok) {
            console.log(`Error fetching access tokens: [${response.status}] ${response.statusText}`);
            return null;
        }

        const json = await response.json();
        return {
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expires: json.expires_in * 1000 + Date.now(),
        };
    }
    catch(err) {
        console.log(`Error fetching access tokens: ${err}`);
        return null;
    }
}

/**
 * Gets the user profile information from the Discord API using the provided access token.
 * @param {Discord.Client} client - The Discord client.
 * @param {string} accessToken - The access token (previously obtained using getTokens).
 * @returns {Promise<?User>} - The user profile information or null if the request failed.
 */
export async function getUser(client, accessToken) {
    try {
        const response = await fetch(`https://discord.com/api/${Discord.Routes.oauth2CurrentAuthorization()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if(!response.ok) {
            console.log(`Error fetching user profile: [${response.status}] ${response.statusText}`);
            return null;
        }

        const json = await response.json();
        return new Discord.User(client, json.user);
    }
    catch(err) {
        console.log(`Error fetching user profile: ${err}`);
        return null;
    }
}
