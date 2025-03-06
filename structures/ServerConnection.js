import Connection from './Connection.js';
import LinkedServer from './LinkedServer.js';
import ServerSettingsConnection from './ServerSettingsConnection.js';

/**
 * Paths to minecraft server files.
 * @type {object}
 */
export const FilePath = {
    /**
     * Constructs the path to the user's advancements file.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @param {?string} [userId=null] - The user's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/advancements/${string}.json`} - The path to the advancements file.
     */
    Advancements: (worldPath, uuid, userId = null) => {
        const advancementPath = `${worldPath}/advancements/${uuid}.json`;
        return userId ? [advancementPath, `./download-cache/userConnection/${userId}/advancements.json`] : advancementPath;
    },
    /**
     * Constructs the path to the user's stats file.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @param {?string} [userId=null] - The user's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/stats/${string}.json`} - The path to the stats file.
     */
    Stats: (worldPath, uuid, userId) => {
        const statPath = `${worldPath}/stats/${uuid}.json`;
        return userId ? [statPath, `./download-cache/userConnection/${userId}/stats.json`] : statPath;
    },
    /**
     * Constructs the path to the user's playerdata folder.
     * @param {string} worldPath - The path to the world folder.
     * @param {string} uuid - The user's UUID.
     * @param {?string} [userId=null] - The user's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/playerdata/${string}.dat`} - The path to the playerdata folder.
     */
    PlayerData: (worldPath, uuid, userId) => {
        const playerdataPath = `${worldPath}/playerdata/${uuid}.dat`;
        return userId ? [playerdataPath, `./download-cache/userConnection/${userId}/playerdata.dat`] : playerdataPath;
    },

    /**
     * Constructs the path to the world's level.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/level.dat`} - The path to the world's level.dat file.
     */
    LevelDat: (worldPath, serverId) => {
        const levelDatPath = `${worldPath}/level.dat`;
        return serverId ? [levelDatPath, `./download-cache/serverConnection/${serverId}/level.dat`] : levelDatPath;
    },

    /**
     * Constructs the path to the world's scoreboard.dat file.
     * @param {string} worldPath - The path to the world folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/data/scoreboard.dat`}
     */
    Scoreboards: (worldPath, serverId) => {
        const scoreboardsPath = `${worldPath}/data/scoreboard.dat`;
        return serverId ? [scoreboardsPath, `./download-cache/serverConnection/${serverId}/scoreboard.dat`] : scoreboardsPath;
    },

    /**
     * Constructs the path to the server's server.properties file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/server.properties`} - The path to the server's server.properties file.
     */
    ServerProperties: (serverPath, serverId) => {
        const serverPropertiesPath = `${serverPath}/server.properties`;
        return serverId ? [serverPropertiesPath, `./download-cache/serverConnection/${serverId}/server.properties`] : serverPropertiesPath;
    },

    /**
     * Constructs the path to the server's server-icon.png file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/server-icon.png`} - The path to the server's server-icon.png file.
     */
    ServerIcon: (serverPath, serverId) => {
        const serverIconPath = `${serverPath}/server-icon.png`;
        return serverId ? [serverIconPath, `./download-cache/serverConnection/${serverId}/server-icon.png`] : serverIconPath;
    },

    /**
     * Constructs the path to the server's whitelist.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/whitelist.json`} - The path to the server's whitelist.json file.
     */
    Whitelist: (serverPath, serverId) => {
        const whitelistPath = `${serverPath}/whitelist.json`;
        return serverId ? [whitelistPath, `./download-cache/serverConnection/${serverId}/whitelist.json`] : whitelistPath;
    },

    /**
     * Constructs the path to the server's ops.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/ops.json`} - The path to the server's ops.json file.
     */
    Operators: (serverPath, serverId) => {
        const operatorsPath = `${serverPath}/ops.json`;
        return serverId ? [operatorsPath, `./download-cache/serverConnection/${serverId}/ops.json`] : operatorsPath;
    },

    /**
     * Constructs the path to the server's banned-players.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/banned-players.json`} - The path to the server's banned-players.json file.
     */
    BannedPlayers: (serverPath, serverId) => {
        const bannedPlayersPath = `${serverPath}/banned-players.json`;
        return serverId ? [bannedPlayersPath, `./download-cache/serverConnection/${serverId}/banned-players.json`] : bannedPlayersPath;
    },

    /**
     * Constructs the path to the server's banned-ips.json file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/banned-ips.json`} - The path to the server's banned-ips.json file.
     */
    BannedIPs: (serverPath, serverId) => {
        const bannedIpsPath = `${serverPath}/banned-ips.json`;
        return serverId ? [bannedIpsPath, `./download-cache/serverConnection/${serverId}/banned-ips.json`] : bannedIpsPath;
    },

    /**
     * Constructs the path to the server's plugins folder.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/plugins`} - The path to the server's plugins folder.
     */
    Plugins: (serverPath, serverId) => {
        const pluginsPath = `${serverPath}/plugins`;
        return serverId ? [pluginsPath, `./download-cache/serverConnection/${serverId}/plugins`] : pluginsPath;
    },

    /**
     * Constructs the path to the server's mods folder.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/mods`} - The path to the server's mods folder.
     */
    Mods: (serverPath, serverId) => {
        const modsPath = `${serverPath}/mods`;
        return serverId ? [modsPath, `./download-cache/serverConnection/${serverId}/mods`] : modsPath;
    },

    /**
     * Constructs the path to the server's datapacks folder.
     * @param {string} worldPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/datapacks`} - The path to the server's datapacks folder.
     */
    DataPacks: (worldPath, serverId) => {
        const datapacksPath = `${worldPath}/datapacks`;
        return serverId ? [datapacksPath, `./download-cache/serverConnection/${serverId}/datapacks`] : datapacksPath;
    },
    /**
     * Constructs the path to the server's floodgate config file.
     * @param {string} serverPath - The path to the server folder.
     * @param {?string} [serverId=null] - The server's ID. If provided, this method will return an array of the remote and the local path.
     * @returns {string[]|`${string}/plugins/floodgate/config.yml`} - The path to the server's floodgate config file.
     */
    FloodgateConfig: (serverPath, serverId) => {
        const floodgateConfigPath = `${serverPath}/plugins/floodgate/config.yml`;
        return serverId ? [floodgateConfigPath, `./download-cache/serverConnection/${serverId}/floodgate-config.yml`] : floodgateConfigPath;
    },
};

export default class ServerConnection extends Connection {

    /**
     * @typedef {object} ServerConnectionData - The data of the server.
     * @property {string} id - The id of the server.
     * @property {Map<string, LinkedServer>} links - The linked servers.
     */

    /**
     * @typedef {ServerConnection|string} ServerConnectionResolvable - Data that resolves to a ServerConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the server-connection for.
     * @param {ServerConnectionData} data - The data for the server-connection.
     * @param {CollectionName} collectionName - The name of the database collection that this connection is stored in.
     * @returns {ServerConnection} - A new ServerConnection instance.
     */
    constructor(client, data, collectionName = 'ServerConnection') {
        super(client, data, collectionName);

        /**
         * The settings for this server.
         * @type {ServerSettingsConnection}
         */
        this.settings = client.serverSettingsConnections._add(ServerSettingsConnection.defaultSettingsData, true, {
            extras: [client.serverSettingsConnections.collectionName],
        });

        this._patch(data);
    }

    /**
     * Returns the ip that should be displayed to users to connect to this server.
     * This returns the displayIp if it is set, otherwise it returns just the ip.
     * @returns {string}
     */
    getDisplayIp() {
        // Either display ip, or just ip
        return this.displayIp ?? this.ip;
    }

    _patch(data) {
        /**
         * The id of this server.
         * @type {string}
         */
        this.id = data.id ?? this.id;

        /**
         * A map of connected servers by their name.
         * @type {Map<string, LinkedServer>}
         */
        this.links ??= new Map();
    }

    /**
     * Adds a new server to the server-connection.
     * @param {LinkedServerData} data
     * @return {Promise<boolean>} - Whether the server was added.
     */
    addServer(data) {
        this.links.set(data.name, new LinkedServer(this.client, data));
        return this._output();
    }

    /**
     * Removes a server from the server-connection.
     * @param {String} name - The name of the server to remove.
     * @return {Promise<boolean>} - Whether the server was removed.
     */
    removeServer(name) {
        this.links.delete(name);
        return this._output();
    }

    /**
     * Finds the server that includes the given name/ip or finds the first server if nameOrIp is undefined.
     * @param {?string} nameOrIp - The name/ip of the server to get.
     * @return {LinkedServer} - The server with the given name/ip or the first server.
     */
    findServer(nameOrIp) {
        if(!nameOrIp) return this.links.values().next().value;
        return this.links.get(nameOrIp);
    }

    /**
     * Syncs the roles of a user with the server.
     * @param {Guild} guild - The guild to sync the roles of the user in.
     * @param {import('discord.js').GuildMember} member - The user to sync the roles of.
     * @param {UserConnection} userConnection - The user connection to sync the roles of.
     * @returns {Promise<void>}
     */
    async syncRoles(guild, member, userConnection) {
        for(const link of this.links.values()) {
            if(!this.syncedRoles || this.syncedRoles.length === 0) return;
            //If user has a synced-role, tell the plugin
            for(const syncedRole of link.syncedRoles.filter(r =>
                !r.players.includes(userConnection.uuid) && member.roles.cache.has(r.id))) {
                await link.addSyncedRoleMember(syncedRole, userConnection.uuid);
            }

            // Add missing synced roles
            for(const syncedRole of link.syncedRoles.filter(r =>
                r.players.includes(userConnection.uuid) && !member.roles.cache.has(r.id))) {
                try {
                    const discordMember = await guild.members.fetch(userConnection.id);
                    const role = await guild.roles.fetch(syncedRole.id);
                    await discordMember.roles.add(role);
                }
                catch(_) {}
            }
        }
    }

    async _output() {
        if(await super._output()) {
            return await this.settings._output();
        }
        else return false;
    }

    /**
     * @inheritDoc
     */
    getData() {
        return {
            id: this.id,
            links: Array.from(this.links.values()).map(s => {
                return {
                    ip: s.ip,
                    version: s.version,
                    path: s.path,
                    worldPath: s.worldPath,
                    online: s.online,
                    forceOnlineMode: s.forceOnlineMode,
                    floodgatePrefix: s.floodgatePrefix,
                    hash: s.hash,
                    requiredRoleToJoin: s.requiredRoleToJoin,
                    chatChannels: s.chatChannels ?? [],
                    statChannels: s.statChannels ?? [],
                    syncedRoles: s.syncedRoles ?? [],
                };
            }),
        };
    }
}
