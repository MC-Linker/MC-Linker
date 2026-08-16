import { compareMinecraftVersions } from '../../utilities/minecraft-utils.js';

/**
 * The location of the files of a minecraft world, which changes between minecraft versions.
 * Every version-specific path literal in the `model` package lives here, so that supporting a new
 * minecraft layout only requires adding a layout below instead of branching on a version string.
 */
export default class WorldFileLayout {

    /**
     * @typedef {object} WorldFileLayoutData - The files and directories of a world, relative to its root.
     * @property {string} advancements - The directory holding the per-player advancement files.
     * @property {string} stats - The directory holding the per-player stat files.
     * @property {string} playerData - The directory holding the per-player `.dat` files.
     * @property {string} levelDat - The world's level.dat file.
     * @property {string} scoreboard - The world's scoreboard.dat file.
     * @property {?string} gameRules - The world's game rules file, or null while they live inside level.dat.
     * @property {?string} worldGenSettings - The world's generator settings file, or null while they live inside level.dat.
     */

    /**
     * The lowest minecraft version that uses {@link WorldFileLayout.V26}.
     * @type {string}
     */
    static V26_SINCE = '26';

    /**
     * The layout used by minecraft 1.8 up to (but excluding) 26.1.
     * @type {WorldFileLayoutData}
     */
    static LEGACY = Object.freeze({
        advancements: 'advancements',
        stats: 'stats',
        playerData: 'playerdata',
        levelDat: 'level.dat',
        scoreboard: 'data/scoreboard.dat',
        // Both still live inside level.dat on this layout.
        gameRules: null,
        worldGenSettings: null,
    });

    /**
     * The layout introduced in minecraft 26.1, which moved the per-player data into `players` and
     * namespaced the saved data in the `data` directory.
     * @type {WorldFileLayoutData}
     */
    static V26 = Object.freeze({
        advancements: 'players/advancements',
        stats: 'players/stats',
        playerData: 'players/data',
        levelDat: 'level.dat',
        scoreboard: 'data/minecraft/scoreboard.dat',
        // 26.1 moved these out of level.dat into their own files. They are stored per dimension rather
        // than under the world's `data` directory, so the overworld copy is the world-level one.
        gameRules: 'dimensions/minecraft/overworld/data/minecraft/game_rules.dat',
        worldGenSettings: 'dimensions/minecraft/overworld/data/minecraft/world_gen_settings.dat',
    });

    /**
     * Resolves the world layout of a server from its minecraft version.
     * An unknown or missing version resolves to {@link WorldFileLayout.LEGACY}, which is both the layout
     * of every version the bot supported before 26.1 and the safer guess for an outdated plugin.
     * @param {?string} version - The minecraft version of the server (e.g. "1.21.8", "26.1.2").
     * @returns {WorldFileLayoutData} - The layout the server uses.
     */
    static forVersion(version) {
        return compareMinecraftVersions(version, WorldFileLayout.V26_SINCE) >= 0
            ? WorldFileLayout.V26
            : WorldFileLayout.LEGACY;
    }
}

export const { LEGACY, V26 } = WorldFileLayout;
