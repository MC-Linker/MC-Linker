/**
 * Provides an interface to the files of a minecraft server. Every file the bot reads is downloaded through a
 * method of this class, so that no command has to know where a file is located or how it is cached.
 *
 * Bound to a single {@link ServerConnection}, from which it takes the world path, the server path, the
 * server id and the world layout. Access it through {@link ServerConnection#files}.
 *
 * The location of the world files changes between minecraft versions, so their paths are built from the
 * {@link import('../model/WorldFileLayout.js').WorldFileLayoutData} of the server (see {@link ServerConnection#worldFileLayout}).
 * The server files are the same on every version.
 *
 * Downloaded files are cached in the download cache of the server they were downloaded from, because
 * {@link Protocol#getWithCache} falls back to that cache whenever a server is offline or a download fails.
 */
export default class ServerFiles {

    /**
     * The folder all downloaded server files are cached in.
     * @type {string}
     */
    static CACHE_ROOT = './download-cache';

    /**
     * The cache names of the files that are downloaded for a single player, by the uuid of that player.
     * Used to download them and to remove them again when a user disconnects their account.
     * @type {Readonly<Object.<string, function(string): string>>}
     */
    static PLAYER_CACHE_NAMES = Object.freeze({
        advancements: uuid => `players/advancements/${uuid}.json`,
        stats: uuid => `players/stats/${uuid}.json`,
        playerData: uuid => `players/playerdata/${uuid}.dat`,
    });

    /**
     * Creates a new file interface for a server.
     * @param {import('../connections/ServerConnection.js').default} server - The server to access the files of.
     * @returns {ServerFiles} - A new ServerFiles instance.
     */
    constructor(server) {
        /**
         * The server these files belong to.
         * @type {import('../connections/ServerConnection.js').default}
         */
        this.server = server;
    }

    /**
     * Builds the folder all downloaded files of a server are cached in.
     * @param {string} serverId - The id of the server.
     * @returns {string} - The cache folder of the server.
     */
    static cacheFolder(serverId) {
        return `${ServerFiles.CACHE_ROOT}/serverConnection/${serverId}`;
    }

    /**
     * Builds the path a downloaded file of a server is cached under.
     * @param {string} serverId - The id of the server the file was downloaded from.
     * @param {string} cacheName - The name of the file, relative to the cache folder of the server.
     * @returns {string} - The path in the download cache.
     */
    static cachePath(serverId, cacheName) {
        return `${ServerFiles.cacheFolder(serverId)}/${cacheName}`;
    }

    /**
     * Builds the paths all cached files of a single player on a server are stored under.
     * @param {string} serverId - The id of the server the files were downloaded from.
     * @param {string} uuid - The uuid of the player.
     * @returns {string[]} - The paths in the download cache.
     */
    static playerCachePaths(serverId, uuid) {
        return Object.values(ServerFiles.PLAYER_CACHE_NAMES)
            .map(cacheName => ServerFiles.cachePath(serverId, cacheName(uuid)));
    }

    /**
     * Downloads the advancements file of a user.
     * @param {string} uuid - The uuid of the user.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    advancements(uuid) {
        const layout = this.server.worldFileLayout;
        return this._worldFile(`${layout.advancements}/${uuid}.json`, ServerFiles.PLAYER_CACHE_NAMES.advancements(uuid));
    }

    /**
     * Downloads the stats file of a user.
     * @param {string} uuid - The uuid of the user.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    stats(uuid) {
        const layout = this.server.worldFileLayout;
        return this._worldFile(`${layout.stats}/${uuid}.json`, ServerFiles.PLAYER_CACHE_NAMES.stats(uuid));
    }

    /**
     * Downloads the playerdata file of a user.
     * @param {string} uuid - The uuid of the user.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    playerData(uuid) {
        const layout = this.server.worldFileLayout;
        return this._worldFile(`${layout.playerData}/${uuid}.dat`, ServerFiles.PLAYER_CACHE_NAMES.playerData(uuid));
    }

    /**
     * Downloads the level.dat file of the world.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    levelDat() {
        const layout = this.server.worldFileLayout;
        return this._worldFile(layout.levelDat, 'level.dat');
    }

    /**
     * Downloads the scoreboard.dat file of the world.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    scoreboard() {
        const layout = this.server.worldFileLayout;
        return this._worldFile(layout.scoreboard, 'scoreboard.dat');
    }

    /**
     * Downloads the server.properties file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    serverProperties() {
        return this._serverFile('server.properties');
    }

    /**
     * Downloads the server-icon.png file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    serverIcon() {
        return this._serverFile('server-icon.png');
    }

    /**
     * Downloads the whitelist.json file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    whitelist() {
        return this._serverFile('whitelist.json');
    }

    /**
     * Downloads the ops.json file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    operators() {
        return this._serverFile('ops.json');
    }

    /**
     * Downloads the banned-players.json file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    bannedPlayers() {
        return this._serverFile('banned-players.json');
    }

    /**
     * Downloads the banned-ips.json file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    bannedIPs() {
        return this._serverFile('banned-ips.json');
    }

    /**
     * Downloads the floodgate config file of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     */
    floodgateConfig() {
        return this._serverFile('plugins/floodgate/config.yml', 'floodgate-config.yml');
    }

    /**
     * Lists the plugins folder of the server.
     * @returns {Promise<Omit<?import('./Protocol.js').ProtocolResponse, 'data'> & { data: import('./Protocol.js').FileData[] }>} - The files in the folder.
     */
    plugins() {
        return this.server.protocol.list(`${this.server.path}/plugins`);
    }

    /**
     * Lists the mods folder of the server.
     * @returns {Promise<Omit<?import('./Protocol.js').ProtocolResponse, 'data'> & { data: import('./Protocol.js').FileData[] }>} - The files in the folder.
     */
    mods() {
        return this.server.protocol.list(`${this.server.path}/mods`);
    }

    /**
     * Lists the datapacks folder of the world.
     * @returns {Promise<Omit<?import('./Protocol.js').ProtocolResponse, 'data'> & { data: import('./Protocol.js').FileData[] }>} - The files in the folder.
     */
    datapacks() {
        return this.server.protocol.list(`${this.server.worldPath}/datapacks`);
    }

    /**
     * Downloads a file relative to the root of the world folder.
     * The world path is normalized to the world root when it is received, so the layout paths can be
     * appended to it as they are.
     * @param {string} worldFilePath - The path to the file, relative to the world root.
     * @param {string} cacheName - The name to cache the file under, relative to the cache folder of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     * @private
     */
    _worldFile(worldFilePath, cacheName) {
        return this.server.protocol.getWithCache(`${this.server.worldPath}/${worldFilePath}`, this._cachePath(cacheName));
    }

    /**
     * Downloads a file relative to the root of the server folder.
     * @param {string} serverFilePath - The path to the file, relative to the server root.
     * @param {string} [cacheName=serverFilePath] - The name to cache the file under, relative to the cache folder of the server.
     * @returns {Promise<?import('./Protocol.js').ProtocolResponse & { data: Buffer, cached: boolean }>} - The downloaded file.
     * @private
     */
    _serverFile(serverFilePath, cacheName = serverFilePath) {
        return this.server.protocol.getWithCache(`${this.server.path}/${serverFilePath}`, this._cachePath(cacheName));
    }

    /**
     * Builds the path a downloaded file of this server is cached under.
     * @param {string} cacheName - The name of the file, relative to the cache folder of the server.
     * @returns {string} - The path in the download cache.
     * @private
     */
    _cachePath(cacheName) {
        return ServerFiles.cachePath(this.server.id, cacheName);
    }
}
