import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import keys from '../../utilities/keys.js';
import { downloadFile, fetchJson } from '../../utilities/http-utils.js';
import GameDataDeriver from './GameDataDeriver.js';
import { trackError } from '../analytics/AnalyticsCollector.js';
import gameRuleDefaults from '../../resources/data/gamerules/defaults.json' with { type: 'json' };
import baselineAdvancements from '../../resources/data/advancements.json' with { type: 'json' };
import baselineCustomStats from '../../resources/data/stats_custom.json' with { type: 'json' };
import baselineGameRules from '../../resources/data/gamerules.json' with { type: 'json' };

const logger = rootLogger.child({ feature: features.structures.render.assetsManager });

/**
 * Downloads, extracts and provides access to official Minecraft client assets and game data per server
 * version. Static singleton — call methods on the class directly. On first use of a version it downloads
 * the client jar, extracts `assets/` to disk plus a derived game data bundle, and deletes the jar;
 * thereafter {@link getAssets} returns the extracted directory and {@link getGameData} the bundle.
 * Rendering lives in {@link import('./ItemRenderer.js').default}.
 */
export default class MinecraftAssetsManager {

    /** @typedef {{ latest: { release: string, snapshot: string }, versions: Array<{ id: string, type: string, url: string }> }} VersionManifest - Mojang's `version_manifest_v2.json` shape. */

    /** Mojang version manifest endpoint listing every published version and its per-version metadata url. */
    static VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
    /** Directory the extracted vanilla resource packs are cached in (gitignored, downloaded at runtime). */
    static ASSETS_ROOT = path.resolve('./resources/minecraft-assets');
    /** Marker file written once a version's assets are fully extracted. Records the extraction scope. */
    static COMPLETE_MARKER = '.complete';
    /**
     * Scope of what the extractor currently produces. Bumping this invalidates older on-disk caches so
     * they are rebuilt (e.g. when the derived game data gains a field).
     * @type {string}
     */
    static EXTRACT_SCOPE = 'render-data-v1';
    /**
     * Prefixes (relative to the jar root) extracted from the client jar. Everything else is skipped.
     * @type {string[]}
     */
    static EXTRACT_PREFIXES = ['assets/', 'pack.mcmeta'];
    /**
     * Prefixes holding the vanilla advancement files. They are *parsed* out of the jar rather than
     * written to disk — only the ~125 with a display block matter and the rest are recipe unlocks.
     * Minecraft renamed the directory to the singular form in the 1.21 line, so both spellings are matched.
     * @type {string[]}
     */
    static ADVANCEMENT_PREFIXES = ['data/minecraft/advancement/', 'data/minecraft/advancements/'];
    /** Path of the English language file inside the jar, the source of every display name. */
    static LANG_PATH = 'assets/minecraft/lang/en_us.json';
    /** Path of the derived game data bundle, relative to a version directory. */
    static DERIVED_FILE = 'derived/game-data.json';
    /** Time-to-live for the cached version manifest, in milliseconds. */
    static MANIFEST_TTL = 60 * 60 * 1000;

    /**
     * The committed baselines, used when a version's own data isn't available — a cold start, a failed
     * download, or a caller that must not block on one (see {@link getGameData}).
     * @type {Readonly<import('./GameDataDeriver.js').GameData>}
     */
    static BASELINE = Object.freeze({
        advancements: baselineAdvancements,
        customStats: baselineCustomStats.stats,
        gameRules: baselineGameRules,
    });

    /**
     * Backoff before retrying a failed background warm, so one unreachable version can't have every chat
     * message queue another doomed download.
     * @type {number}
     */
    static WARM_RETRY_COOLDOWN = 10 * 60 * 1000;

    /**
     * Derived game data per resolved version id.
     * @private
     * @type {Map<string, import('./GameDataDeriver.js').GameData>}
     */
    static gameDataCache = new Map();

    /**
     * Resolved version id per raw server version, so the non-blocking path keeps working once the
     * manifest goes stale.
     * @private
     * @type {Map<string, string>}
     */
    static resolvedVersions = new Map();

    /**
     * Versions with a background warm in flight.
     * @private
     * @type {Set<string>}
     */
    static warming = new Set();

    /**
     * When a version's background warm last failed.
     * @private
     * @type {Map<string, number>}
     */
    static warmFailures = new Map();

    /**
     * In-flight extraction promises per resolved version id. Deduplicates concurrent callers so a given
     * version is only ever downloaded/extracted once.
     * @private
     * @type {Map<string, Promise<string>>}
     */
    static downloadPromises = new Map();

    /**
     * Cached version manifest and the time it was fetched.
     * @private
     * @type {{ data: VersionManifest, fetchedAt: number }|null}
     */
    static manifest = null;

    /**
     * Resolves a (possibly partial) version and returns the path to its extracted assets, downloading +
     * extracting the client jar on first use. A missing asset set is an error (surfaced by the command
     * dispatcher), not a `null`.
     * @param {string} version - The server version, exact (`"1.21.4"`) or partial (`"1.21"`).
     * @param {(import('discord.js').BaseInteraction & import('../../types/TranslatedResponses.js').TranslatedResponses)} [interaction] - Optional deferred interaction; edited with a "downloading assets" step embed on a cache miss.
     * @returns {Promise<string>} Path to the extracted resource-pack directory for the resolved version.
     * @throws {Error} If the version can't be resolved, or the jar can't be downloaded/extracted.
     */
    static async getAssets(version, interaction = null) {
        const resolvedId = await this.resolveVersion(version);
        if(!resolvedId) throw new Error(`Could not resolve a Minecraft version for "${version}"`);

        const dir = path.join(this.ASSETS_ROOT, resolvedId);
        if(this.downloadPromises.has(resolvedId)) return await this.downloadPromises.get(resolvedId);
        if(await this.isExtracted(dir)) return dir;

        await interaction?.editReplyTl(keys.common.step.loading_assets, { version: resolvedId });

        const promise = this.downloadAndExtract(resolvedId, dir).then(() => dir);
        this.downloadPromises.set(resolvedId, promise);

        try {
            return await promise;
        }
        finally {
            this.downloadPromises.delete(resolvedId);
        }
    }

    /**
     * Resolves a server version to a concrete version id from the manifest, downloading the assets for
     * *that exact* version. Falls back to the manifest's latest release.
     * @private
     * @param {string} version - The version to resolve.
     * @returns {Promise<string|null>} The resolved version id, or `null` if the manifest is unavailable.
     */
    static async resolveVersion(version) {
        if(!version) return null;
        version = version.trim();
        const manifest = await this.getManifest();
        if(!manifest) return null;

        // Exact id match — releases, snapshots, and pre-releases/RCs are all matched here.
        const resolvedId = manifest.versions.some(v => v.id === version) ? version : manifest.latest.release;
        this.resolvedVersions.set(version, resolvedId);
        return resolvedId;
    }

    /**
     * Resolves a version without ever touching the network, for callers that must not block —
     * {@link getGameData} with `wait: false` is on the chat relay's hot path.
     *
     * Past resolutions are remembered indefinitely so an expired manifest does not send a caller back to
     * the baseline for a version whose data is already on disk. A version only ever resolves to one id.
     * @private
     * @param {string} version - The version to resolve.
     * @returns {?string} The resolved version id, or `null` if this version has never been resolved and there is no fresh manifest.
     */
    static resolveVersionFromCache(version) {
        if(!version) return null;
        version = version.trim();

        const remembered = this.resolvedVersions.get(version);
        if(remembered) return remembered;
        if(!this.manifest || Date.now() - this.manifest.fetchedAt >= this.MANIFEST_TTL) return null;

        const { data } = this.manifest;
        const resolvedId = data.versions.some(v => v.id === version) ? version : data.latest.release;
        this.resolvedVersions.set(version, resolvedId);
        return resolvedId;
    }

    /**
     * Returns the advancements, custom statistics and game rules of a server's Minecraft version.
     *
     * Version-exact wherever the version's assets are available.
     * `wait: false` never blocks: it answers from what is already cached, and starts a background fetch
     * when it isn't.
     * @param {string} version - The server's Minecraft version.
     * @param {{ wait?: boolean, interaction?: (import('discord.js').BaseInteraction & import('../../types/TranslatedResponses.js').TranslatedResponses) }} [options] - `wait: false` returns immediately with the best data available and warms the rest in the background.
     * @returns {Promise<import('./GameDataDeriver.js').GameData>} The version's game data, or the baseline.
     * @throws {Error} If the assets have to be downloaded and that fails. Never throws when `wait` is false.
     */
    static async getGameData(version, { wait = true, interaction = null } = {}) {
        const resolvedId = wait ? await this.resolveVersion(version) : this.resolveVersionFromCache(version);
        if(resolvedId && this.gameDataCache.has(resolvedId)) return this.gameDataCache.get(resolvedId);

        if(!wait) {
            const dir = resolvedId ? path.join(this.ASSETS_ROOT, resolvedId) : null;
            if(dir && await this.isExtracted(dir)) return await this.readGameData(resolvedId, dir);

            this.warmGameData(version);
            return this.BASELINE;
        }

        if(!resolvedId) return this.BASELINE;
        return await this.readGameData(resolvedId, await this.getAssets(version, interaction));
    }

    /**
     * Reads a version's derived bundle off disk and memoizes it.
     * @private
     * @param {string} resolvedId - The resolved version id.
     * @param {string} dir - The version's extracted directory.
     * @returns {Promise<import('./GameDataDeriver.js').GameData>} The bundle.
     * @throws {Error} If the bundle is missing or unreadable.
     */
    static async readGameData(resolvedId, dir) {
        const data = await fs.readJson(path.join(dir, this.DERIVED_FILE));
        this.gameDataCache.set(resolvedId, data);
        return data;
    }

    /**
     * Fetches a version's game data in the background, so a later non-blocking read finds it. Not awaited
     * by its caller; concurrent calls for the same version collapse into one.
     * @param {string} version - The server's Minecraft version.
     * @returns {void}
     */
    static warmGameData(version) {
        if(!version || this.warming.has(version)) return;

        const failedAt = this.warmFailures.get(version);
        if(failedAt && Date.now() - failedAt < this.WARM_RETRY_COOLDOWN) return;

        this.warming.add(version);
        this.getGameData(version)
            .then(() => this.warmFailures.delete(version))
            .catch(err => {
                this.warmFailures.set(version, Date.now());
                trackError('unhandled', 'assetsManager', null, null, err, `Could not warm game data for version ${version}`, logger);
            })
            .finally(() => this.warming.delete(version));
    }

    /**
     * Returns the version manifest, cached for {@link MinecraftAssetsManager.MANIFEST_TTL}.
     * @private
     * @returns {Promise<VersionManifest|null>} The manifest data, or `null` on failure.
     */
    static async getManifest() {
        if(this.manifest && Date.now() - this.manifest.fetchedAt < this.MANIFEST_TTL) return this.manifest.data;

        const data = await fetchJson(this.VERSION_MANIFEST_URL);
        if(!data?.versions) return null;
        this.manifest = { data, fetchedAt: Date.now() };
        return data;
    }

    /**
     * Whether a version directory holds a complete extraction matching the current
     * {@link MinecraftAssetsManager.EXTRACT_SCOPE}.
     * @private
     * @param {string} dir - The version directory.
     * @returns {Promise<boolean>} `true` if the directory is up-to-date.
     */
    static async isExtracted(dir) {
        try {
            const marker = await fs.readJson(path.join(dir, this.COMPLETE_MARKER));
            return marker.scope === this.EXTRACT_SCOPE;
        }
        catch {
            return false;
        }
    }

    /**
     * Downloads the client jar for a resolved version and extracts the rendering assets to `dir`, then
     * deletes the jar and writes the `.complete` marker. Extracts into a temp dir first so a partially
     * written directory is never mistaken for a complete one.
     * @private
     * @param {string} resolvedId - The resolved version id.
     * @param {string} dir - The destination version directory.
     * @returns {Promise<void>}
     * @throws {Error} If the version isn't in the manifest or has no client download.
     */
    static async downloadAndExtract(resolvedId, dir) {
        const jarPath = path.join(os.tmpdir(), `mclinker-${resolvedId}-${process.pid}.jar`);
        const tmpDir = `${dir}.tmp`;

        try {
            await this.downloadJar(resolvedId, jarPath);

            //remove to clear previous contents
            await fs.remove(tmpDir);
            await fs.ensureDir(tmpDir);

            const zip = new AdmZip(jarPath);
            for(const zipEntry of zip.getEntries()) {
                const name = zipEntry.entryName;
                // Directory entries are empty markers (e.g. `assets/`) with no data; the files inside are
                // their own entries (`assets/minecraft/...`) and are still matched + written below, with
                // `fs.ensureDir` recreating the folders. So skipping directory entries drops nothing.
                if(zipEntry.isDirectory || !this.EXTRACT_PREFIXES.some(p => name.startsWith(p))) continue;

                const dest = path.join(tmpDir, name);
                await fs.ensureDir(path.dirname(dest));
                await fs.writeFile(dest, zipEntry.getData());
            }

            await fs.outputJson(path.join(tmpDir, this.DERIVED_FILE), this.deriveGameData(zip));

            await fs.writeFile(
                path.join(tmpDir, this.COMPLETE_MARKER),
                JSON.stringify({
                    scope: this.EXTRACT_SCOPE,
                    version: resolvedId,
                    extractedAt: new Date().toISOString(),
                }),
            );

            // Atomic-ish swap: remove any stale dir, then move the fully-extracted temp dir into place.
            await fs.remove(dir);
            await fs.move(tmpDir, dir);
            logger.debug(`Extracted Minecraft ${resolvedId} assets to ${dir}`);
        }
        finally {
            await fs.remove(jarPath).catch(() => {});
            await fs.remove(tmpDir).catch(() => {});
        }
    }

    /**
     * Downloads a version's client jar.
     * @param {string} resolvedId - The resolved version id.
     * @param {string} dest - Path to write the jar to.
     * @returns {Promise<string>} The path the jar was written to.
     * @throws {Error} If the version isn't in the manifest, has no client download, or the download fails.
     */
    static async downloadJar(resolvedId, dest) {
        const manifest = await this.getManifest();
        const entry = manifest?.versions.find(v => v.id === resolvedId);
        if(!entry) throw new Error(`Version ${resolvedId} not found in manifest`);

        // manifest → per-version metadata → client jar download url.
        const meta = await fetchJson(entry.url);
        const clientUrl = meta?.downloads?.client?.url;
        if(!clientUrl) throw new Error(`No client download for version ${resolvedId}`);

        logger.debug(`Downloading Minecraft ${resolvedId} client jar from ${clientUrl}`);
        await downloadFile(clientUrl, dest);
        return dest;
    }

    /**
     * Derives the game data bundle from an open client jar. Shared with
     * `scripts/gamedata/generate-game-data.js`, so the baselines and runtime data come from the same code.
     * @param {import('adm-zip')} zip - The opened client jar.
     * @param {{ id: string, legacyName: ?string, inverted: boolean, type: string, default: (boolean|number) }[]} [defaults] - The game rule defaults. Passed explicitly by the generator, which rewrites them in the same run.
     * @returns {import('./GameDataDeriver.js').GameData} The derived bundle.
     * @throws {Error} If the jar has no English language file, or an advancement file is not valid JSON.
     */
    static deriveGameData(zip, defaults = gameRuleDefaults) {
        const langEntry = zip.getEntry(this.LANG_PATH);
        if(!langEntry) throw new Error(`Client jar has no ${this.LANG_PATH}`);
        const lang = JSON.parse(langEntry.getData().toString());

        const advancements = [];
        for(const zipEntry of zip.getEntries()) {
            if(zipEntry.isDirectory) continue;

            const prefix = this.ADVANCEMENT_PREFIXES.find(p => zipEntry.entryName.startsWith(p));
            if(!prefix) continue;

            advancements.push({
                path: zipEntry.entryName.slice(prefix.length).replace(/\.json$/, ''),
                json: JSON.parse(zipEntry.getData().toString()),
            });
        }

        return {
            advancements: GameDataDeriver.deriveAdvancements(advancements, lang),
            customStats: GameDataDeriver.deriveCustomStats(lang),
            gameRules: GameDataDeriver.deriveGameRules(lang, defaults),
        };
    }

    /**
     * The id of the latest Minecraft release, which the committed baselines are generated from.
     * @returns {Promise<?string>} The latest release id, or `null` if the manifest is unavailable.
     */
    static async latestRelease() {
        const manifest = await this.getManifest();
        return manifest?.latest?.release ?? null;
    }

}