import Canvas from 'skia-canvas';
import path from 'node:path';
import fs from 'fs-extra';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import { MinecraftDataVersion } from '../../utilities/minecraft-utils.js';
import AssetsManager from './MinecraftAssetsManager.js';

const logger = rootLogger.child({ feature: features.structures.render.playerHeadRenderer });

/**
 * Renders player head avatars (face + hat overlay) straight from Mojang-hosted skin textures. Static singleton.
 * Skins are fetched from `textures.minecraft.net` by texture hash (the last path segment of the skin url in a
 * player's session profile), so a hash fully identifies an image and rendered heads can be cached indefinitely.
 * The Steve fallback is cropped from the default skin inside the official client assets ({@link AssetsManager}).
 */
export default class PlayerHeadRenderer {

    /** Mojang's skin texture host. Only this host is ever fetched, so callers can't make the bot request arbitrary urls. */
    static TEXTURE_BASE_URL = 'https://textures.minecraft.net/texture/';
    /** Valid texture hash (Mojang uses lowercase hex sha256 hashes; older skins may be shorter). */
    static TEXTURE_HASH_REGEX = /^[0-9a-f]{32,64}$/;
    /** Special id used for the default Steve head. */
    static STEVE_ID = 'steve';
    /** Path of the default Steve skin inside an extracted client asset pack (1.19.3+ layout). */
    static STEVE_SKIN_PATH = 'assets/minecraft/textures/entity/player/wide/steve.png';
    /** Output size (px) of a rendered head. 16× the 8 px face so Discord displays it crisply. */
    static SIZE = 128;
    /** Max number of rendered heads kept in memory (~1-3 KB each). */
    static CACHE_MAX_SIZE = 2000;
    /** Timeout (ms) for downloading a skin texture. */
    static FETCH_TIMEOUT_MS = 5000;

    /**
     * Rendered head PNGs keyed by texture hash (or {@link STEVE_ID}). Insertion-ordered for LRU-ish eviction.
     * @private
     * @type {Map<string, Buffer>}
     */
    static cache = new Map();

    /**
     * In-flight renders keyed by id, so concurrent requests for the same head only fetch the skin once.
     * @private
     * @type {Map<string, Promise<?Buffer>>}
     */
    static pending = new Map();

    /**
     * Returns whether the given id can be rendered (a texture hash or {@link STEVE_ID}).
     * @param {string} id
     * @returns {boolean}
     */
    static isValidId(id) {
        return id === this.STEVE_ID || this.TEXTURE_HASH_REGEX.test(id);
    }

    /**
     * Returns the rendered head PNG for the given texture hash or {@link STEVE_ID}.
     * @param {string} id - The skin texture hash or {@link STEVE_ID}.
     * @returns {Promise<?Buffer>} The PNG, or `null` if the id is invalid or the skin can't be fetched.
     */
    static async getHead(id) {
        if(!this.isValidId(id)) return null;
        if(this.cache.has(id)) return this.cache.get(id);
        if(this.pending.has(id)) return await this.pending.get(id);

        const promise = this.loadAndRender(id);
        this.pending.set(id, promise);
        try {
            return await promise;
        }
        finally {
            this.pending.delete(id);
        }
    }

    /**
     * Fetches the skin for the given id and renders + caches its head.
     * @private
     * @param {string} id - The skin texture hash or {@link STEVE_ID}.
     * @returns {Promise<?Buffer>} The PNG, or `null` on failure.
     */
    static async loadAndRender(id) {
        try {
            const skin = id === this.STEVE_ID ? await this.loadSteveSkin() : await this.fetchSkin(id);
            const head = await this.renderHead(skin);
            this.cache.set(id, head);
            if(this.cache.size > this.CACHE_MAX_SIZE) this.cache.delete(this.cache.keys().next().value);
            return head;
        }
        catch(err) {
            logger.warn({ err, id }, 'Failed to render player head');
            return null;
        }
    }

    /**
     * Downloads a skin texture from Mojang.
     * @private
     * @param {string} hash - The texture hash.
     * @returns {Promise<Buffer>}
     */
    static async fetchSkin(hash) {
        const res = await fetch(this.TEXTURE_BASE_URL + hash, { signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS) });
        if(!res.ok) throw new Error(`GET ${this.TEXTURE_BASE_URL}${hash} → ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    }

    /**
     * Reads the default Steve skin from the official client assets.
     * @private
     * @returns {Promise<Buffer>}
     */
    static async loadSteveSkin() {
        const assetsDir = await AssetsManager.getAssets(MinecraftDataVersion);
        return await fs.readFile(path.join(assetsDir, this.STEVE_SKIN_PATH));
    }

    /**
     * Renders the front of a player's head (face + hat overlay) from a skin texture, the way the game draws it.
     * Supports modern 64×64 skins and legacy 64×32 skins (including the vanilla "Notch transparency hack":
     * a legacy hat layer without any transparent pixel is ignored, as the game does).
     * @param {Buffer} skinBuffer - The skin PNG.
     * @returns {Promise<Buffer>} A {@link SIZE}×{@link SIZE} PNG of the head.
     */
    static async renderHead(skinBuffer) {
        const skin = await Canvas.loadImage(skinBuffer);
        if(skin.width !== 64 || (skin.height !== 64 && skin.height !== 32)) {
            throw new Error(`Unsupported skin size ${skin.width}x${skin.height}`);
        }

        // Read the skin's pixels to check the hat layer
        const source = new Canvas.Canvas(skin.width, skin.height);
        const sourceCtx = source.getContext('2d');
        sourceCtx.drawImage(skin, 0, 0);
        const hat = sourceCtx.getImageData(40, 8, 8, 8).data;

        let hasHat = false;
        let hasTransparency = false;
        for(let i = 3; i < hat.length; i += 4) {
            if(hat[i] > 0) hasHat = true;
            if(hat[i] < 128) hasTransparency = true;
        }
        const legacy = skin.height === 32;
        const drawHat = hasHat && (!legacy || hasTransparency);

        // Compose the 8×8 face. The game renders the base head layer fully opaque, so force alpha to 255.
        const face = sourceCtx.getImageData(8, 8, 8, 8);
        for(let i = 3; i < face.data.length; i += 4) face.data[i] = 255;
        const head = new Canvas.Canvas(8, 8);
        const headCtx = head.getContext('2d');
        headCtx.putImageData(face, 0, 0);
        if(drawHat) headCtx.drawImage(source, 40, 8, 8, 8, 0, 0, 8, 8);

        const canvas = new Canvas.Canvas(this.SIZE, this.SIZE);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(head, 0, 0, this.SIZE, this.SIZE);

        return await canvas.toBuffer('png');
    }
}
