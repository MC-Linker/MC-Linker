import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import keys from '../../utilities/keys.js';
import { downloadFile, fetchJson } from '../../utilities/http-utils.js';

const logger = rootLogger.child({ feature: features.structures.render.assetsManager });

/**
 * Downloads, extracts and provides access to official Minecraft client assets per server version. Static
 * singleton — call methods on the class directly. On first use of a version it downloads the client jar,
 * extracts `assets/` to disk, and deletes the jar; thereafter {@link getAssets} returns the extracted
 * directory. Rendering lives in {@link import('./ItemRenderer.js').default}; future data access
 * (advancements, stats, etc.) will be added here.
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
     * Scope of files the extractor currently keeps. Bumping this invalidates older on-disk caches so they
     * are re-extracted (e.g. when a future phase additionally extracts `data/minecraft/advancement/`).
     * @type {string}
     */
    static EXTRACT_SCOPE = 'render-v1';
    /**
     * Prefixes (relative to the jar root) extracted from the client jar. Everything else is skipped.
     * @type {string[]}
     */
    static EXTRACT_PREFIXES = ['assets/', 'pack.mcmeta'];
    /** Time-to-live for the cached version manifest, in milliseconds. */
    static MANIFEST_TTL = 60 * 60 * 1000;

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
        if(manifest.versions.some(v => v.id === version)) return version;
        return manifest.latest.release;
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
        const manifest = await this.getManifest();
        const entry = manifest?.versions.find(v => v.id === resolvedId);
        if(!entry) throw new Error(`Version ${resolvedId} not found in manifest`);

        // manifest → per-version metadata → client jar download url.
        const meta = await fetchJson(entry.url);
        const clientUrl = meta?.downloads?.client?.url;
        if(!clientUrl) throw new Error(`No client download for version ${resolvedId}`);

        const jarPath = path.join(os.tmpdir(), `mclinker-${resolvedId}-${process.pid}.jar`);
        const tmpDir = `${dir}.tmp`;

        try {
            logger.debug(`Downloading Minecraft ${resolvedId} assets from ${clientUrl}`);
            await downloadFile(clientUrl, jarPath);

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
            logger.info(`Extracted Minecraft ${resolvedId} assets to ${dir}`);
        }
        finally {
            await fs.remove(jarPath).catch(() => {});
            await fs.remove(tmpDir).catch(() => {});
        }
    }

}