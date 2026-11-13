import Canvas from 'skia-canvas';
import path from 'node:path';
import fs from 'fs-extra';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import { MinecraftDataVersion } from '../../utilities/minecraft-utils.js';
import AssetsManager from './MinecraftAssetsManager.js';

const logger = rootLogger.child({ feature: features.structures.render.playerHeadRenderer });

/**
 * Player head avatars, built only from Mojang data. Static singleton.
 *
 * Lookup: {@link getAvatarURL} resolves username → uuid via `api.mojang.com`, reads the skin texture hash from the
 * `sessionserver.mojang.com` profile and returns `<PUBLIC_URL>/avatar/<hash>.png`, served by `api/routes/Avatar.js`.
 * Lookups are cached per username and paused while Mojang rate limits the bot.
 *
 * Rendering: {@link getHead} draws the face + hat overlay from the skin texture. Skins are fetched from `textures.minecraft.net` by texture hash (the last path segment of the skin url in a
 * player's session profile), so a hash fully identifies an image and rendered heads can be cached indefinitely.
 * The Steve fallback is cropped from the default skin inside the official client assets ({@link AssetsManager}).
 */
export default class PlayerHeadRenderer {

    /** Mojang's skin texture host. Only this host is ever fetched, so callers can't make the bot request arbitrary urls. */
    static TEXTURE_BASE_URL = 'https://textures.minecraft.net/texture/';
    /** Valid texture hash (Mojang uses lowercase hex sha256 hashes; older skins may be shorter). */
    static TEXTURE_HASH_REGEX = /^[0-9a-f]{32,64}$/;
    /** Player names Mojang accepts. Anything else (e.g. Floodgate-prefixed Bedrock names) can't have a Java skin. */
    static USERNAME_REGEX = /^[A-Za-z0-9_]{1,16}$/;
    /** Special id used for the default Steve head. */
    static STEVE_ID = 'steve';
    /** Path of the default Steve skin inside an extracted client asset pack (1.19.3+ layout). */
    static STEVE_SKIN_PATH = 'assets/minecraft/textures/entity/player/wide/steve.png';
    /** Output size (px) of a rendered head. 16× the 8 px face so Discord displays it crisply. */
    static SIZE = 128;
    /** Max number of rendered heads kept in memory (~1-3 KB each). */
    static CACHE_MAX_SIZE = 2000;
    /** Timeout (ms) for every Mojang request, so a slow Mojang API can't stall commands (falls back to Steve). */
    static FETCH_TIMEOUT_MS = 5000;
    /** How long a username → avatar url lookup is cached. */
    static AVATAR_CACHE_TTL_MS = 60 * 60_000;
    /** How long a failed lookup (rate limit, network error) is cached, so it's retried sooner. */
    static AVATAR_FAILURE_CACHE_TTL_MS = 5 * 60_000;
    /** Max number of cached username lookups. */
    static AVATAR_CACHE_MAX_SIZE = 5000;
    /** How long to stop querying Mojang after a 429 without a `Retry-After` header, or after repeated failures. */
    static MOJANG_BACKOFF_MS = 60_000;
    /** Consecutive failed lookups (timeouts, network/5xx errors) before backing off. */
    static MOJANG_MAX_CONSECUTIVE_FAILURES = 3;

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
     * Cached username lookups keyed by lowercased username. Insertion-ordered for LRU-ish eviction.
     * @private
     * @type {Map<string, { url: ?string, expiresAt: number }>}
     */
    static avatarCache = new Map();

    /**
     * In-flight lookups keyed by lowercased username, so concurrent callers share one Mojang request.
     * @private
     * @type {Map<string, Promise<?string>>}
     */
    static pendingAvatars = new Map();

    /**
     * Timestamp until which no Mojang lookups are sent.
     * @private
     * @type {number}
     */
    static mojangBackoffUntil = 0;

    /**
     * Number of failed Mojang lookups in a row.
     * @private
     * @type {number}
     */
    static mojangConsecutiveFailures = 0;

    /**
     * Returns the public base url of this bot's API, under which `/avatar/:id` serves rendered player heads.
     * Uses `PUBLIC_URL`, falling back to the origin of `LINKED_ROLES_REDIRECT_URI` (which already points at the API).
     * @returns {?string} The base url without a trailing slash, or `null` if none is configured.
     */
    static getPublicApiURL() {
        if(process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
        try {
            return new URL(process.env.LINKED_ROLES_REDIRECT_URI).origin;
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Builds the url of a rendered player head served by this bot's API (see `api/routes/Avatar.js`).
     * @param {string} id - The skin texture hash or {@link STEVE_ID}.
     * @returns {?string} The url, or `null` if no public API url is configured.
     */
    static getHeadURL(id) {
        const base = this.getPublicApiURL();
        return base ? `${base}/avatar/${id}.png` : null;
    }

    /**
     * Returns the url of the given player's head avatar, rendered from their Mojang skin. Cached per username, only
     * querying Mojang when the cache is expired or missing. Falls back to Steve if the player doesn't exist, has no
     * custom skin, or the lookup fails (in which case a previously known head is kept).
     * @param {string} username - The player's username.
     * @returns {Promise<?string>} The avatar url, or `null` if no public API url is configured.
     */
    static async getAvatarURL(username) {
        const key = String(username).toLowerCase();
        const cached = this.avatarCache.get(key);
        if(cached && Date.now() < cached.expiresAt) return cached.url;
        if(this.pendingAvatars.has(key)) return await this.pendingAvatars.get(key);

        const promise = this.fetchSkinTextureHash(username).then(({ hash, definitive }) => {
            let url = this.getHeadURL(hash ?? this.STEVE_ID);
            // On a failed lookup (rate limit, Mojang down), keep showing the player's last known head instead of Steve.
            if(!definitive && cached?.url) url = cached.url;

            this.avatarCache.delete(key); // Re-insert to keep insertion order ~ recency for eviction
            this.avatarCache.set(key, {
                url,
                expiresAt: Date.now() + (definitive ? this.AVATAR_CACHE_TTL_MS : this.AVATAR_FAILURE_CACHE_TTL_MS),
            });
            if(this.avatarCache.size > this.AVATAR_CACHE_MAX_SIZE) this.avatarCache.delete(this.avatarCache.keys().next().value);
            return url;
        });

        this.pendingAvatars.set(key, promise);
        try {
            return await promise;
        }
        finally {
            this.pendingAvatars.delete(key);
        }
    }

    /**
     * Looks up the skin texture hash of a player directly from Mojang: username → uuid via `api.mojang.com`, then the
     * session profile's `textures` property via `sessionserver.mojang.com`.
     * @param {string} username - The player's username.
     * @returns {Promise<{ hash: ?string, definitive: boolean }>} `hash` is the texture hash, or `null` if the player
     * doesn't exist or has no custom skin. `definitive` is `false` when the lookup failed (network error, rate limit,
     * backoff), so callers can retry sooner.
     */
    static async fetchSkinTextureHash(username) {
        if(!this.USERNAME_REGEX.test(username ?? '')) return { hash: null, definitive: true };
        // While Mojang is rate limiting us (or down), don't send more requests: they'd only prolong the limit.
        if(Date.now() < this.mojangBackoffUntil) return { hash: null, definitive: false };

        const signal = () => AbortSignal.timeout(this.FETCH_TIMEOUT_MS);
        try {
            const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, { signal: signal() });
            if(profileRes.status === 404 || profileRes.status === 204) return this.lookupSucceeded({ hash: null, definitive: true });
            if(!profileRes.ok) return this.lookupFailed(profileRes);
            const { id } = await profileRes.json();
            if(!id) return this.lookupSucceeded({ hash: null, definitive: true });

            const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, { signal: signal() });
            if(sessionRes.status === 404 || sessionRes.status === 204) return this.lookupSucceeded({ hash: null, definitive: true });
            if(!sessionRes.ok) return this.lookupFailed(sessionRes);
            const session = await sessionRes.json();

            const texturesProperty = session.properties?.find(p => p.name === 'textures')?.value;
            if(!texturesProperty) return this.lookupSucceeded({ hash: null, definitive: true });
            const skinURL = JSON.parse(Buffer.from(texturesProperty, 'base64').toString('utf8')).textures?.SKIN?.url;
            if(!skinURL) return this.lookupSucceeded({ hash: null, definitive: true }); // Default skin

            const hash = new URL(skinURL).pathname.split('/').pop().toLowerCase();
            return this.lookupSucceeded({ hash, definitive: true });
        }
        catch(err) {
            return this.lookupFailed(null);
        }
    }

    /**
     * Records a lookup that reached Mojang successfully.
     * @private
     * @template T
     * @param {T} result
     * @returns {T}
     */
    static lookupSucceeded(result) {
        this.mojangConsecutiveFailures = 0;
        return result;
    }

    /**
     * Records a failed lookup and starts a backoff on a 429 (honouring `Retry-After`) or after repeated failures.
     * @private
     * @param {?Response} res - The failed response, or `null` on a network error / timeout.
     * @returns {{ hash: null, definitive: false }}
     */
    static lookupFailed(res) {
        this.mojangConsecutiveFailures++;
        let backoff = 0;
        if(res?.status === 429) {
            const retryAfterSeconds = Number(res.headers.get('retry-after'));
            backoff = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : this.MOJANG_BACKOFF_MS;
        }
        else if(this.mojangConsecutiveFailures >= this.MOJANG_MAX_CONSECUTIVE_FAILURES) {
            backoff = this.MOJANG_BACKOFF_MS;
        }

        if(backoff > 0) {
            this.mojangBackoffUntil = Math.max(this.mojangBackoffUntil, Date.now() + backoff);
            this.mojangConsecutiveFailures = 0;
        }
        return { hash: null, definitive: false };
    }

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
