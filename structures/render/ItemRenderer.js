import Canvas from 'skia-canvas';
import {
    loadModel,
    makeModelScene,
    parseItemDefinition,
    prepareAssets,
    renderModelScene,
    resolveModelData,
} from 'block-model-renderer';
import rootLogger from '../../utilities/logger/Logger.js';
import features from '../../utilities/logger/features.js';
import { compareMinecraftVersions } from '../../utilities/minecraft-utils.js';
import { trackError } from '../analytics/AnalyticsCollector.js';
import AssetsManager from './MinecraftAssetsManager.js';
import ItemImages from './ItemImages.js';

const logger = rootLogger.child({ feature: features.structures.render.itemRenderer });

/**
 * Renders Minecraft item/block icons from a version's assets via `block-model-renderer`. Static
 * singleton. Each request renders only its *uncached* items in one batched headless-GL pass, crops each
 * into a per-item image cache, and reuses cached images thereafter — so a fully warm request creates
 * zero GL contexts. Asset acquisition (download/extract) is delegated to {@link AssetsManager}.
 */
export default class ItemRenderer {

    /** @typedef {Awaited<ReturnType<import('block-model-renderer').prepareAssets>>} PreparedAssets */
    /** @typedef {{ id: string, components?: Object }} ItemSpec - An item to render: id + optional appearance components. */

    /** Minecraft version that introduced item-definition files (`assets/<ns>/items/<id>.json`). Below this, items are resolved straight from their `models/item/<id>.json` instead. */
    static ITEM_DEFINITION_SINCE = '1.21.4';
    /** Display context for item GUI icons; drives tint resolution and the model's `gui` display transform. */
    static GUI_DISPLAY = { type: 'fallback', display: 'gui' };

    /** Max width/height (px) of a single batched render, to stay within the headless-GL framebuffer limit. */
    static MAX_RENDER_DIM = 8192;
    /** Size (px) each item image is rendered + cached at — 2× the largest display size (stats' 64 px) so every command downscales a crisp source and one cache entry serves all three (the key omits size). */
    static CANONICAL_SIZE = 128;
    /** Supersample-anti-aliasing factor: the grid renders at this multiple of the cell's canonical pixels, then each crop is downscaled with smoothing for clean edges (clamped by {@link ItemRenderer.MAX_RENDER_DIM}). */
    static GRID_SUPERSAMPLE = 2;
    /** Max number of rendered item images kept in the in-memory LRU before the oldest are evicted. */
    static IMAGE_CACHE_MAX = 2000;
    /** Unique marker stored in the image cache for an item that can't be rendered in a given version (no model/definition, or it threw) — distinct from "absent" (not yet attempted) and a real `Buffer`, so warm calls skip re-rendering it. */
    static UNRENDERABLE = Symbol('unrenderable');

    /**
     * Bounded LRU of rendered item images, keyed `version:id:componentsHash`. Values are canonical-size
     * PNG `Buffer`s, or {@link ItemRenderer.UNRENDERABLE} for items that can't be rendered in that version.
     * @private
     * @type {Map<string, Buffer|symbol>}
     */
    static imageCache = new Map();

    /**
     * Prepared assets per extracted-version directory (the `prepareAssets()` result is idempotent and
     * reusable across renders).
     * @private
     * @type {Map<string, PreparedAssets>}
     */
    static preparedCache = new Map();

    /**
     * Returns the rendered icons for the requested items. Only uncached items trigger an asset
     * download/prepare + GL render; a fully warm request touches neither disk nor GPU.
     *
     * The returned {@link ItemImages} composites each icon by its `version:id:componentsHash` key (build
     * one with {@link imageKey}), falling back to text when an item has no image.
     * @param {ItemSpec[]} specs - The items to render (id + optional components, e.g. `minecraft:potion_contents`).
     * @param {string} version - The server's Minecraft version (for era-correct behaviour + cache keys).
     * @param {(import('discord.js').BaseInteraction & import('../../types/TranslatedResponses.js').TranslatedResponses)} [interaction] - Deferred interaction, edited with a "downloading assets" step embed if a download is needed.
     * @returns {Promise<ItemImages>} A handle for compositing each requested icon onto a canvas.
     * @throws {Error} If uncached items exist and their version's assets can't be downloaded/prepared.
     */
    static async getItemImages(specs, version, interaction = null) {
        /** @type {Map<string, ItemSpec>} */
        const uniqueSpecs = new Map();
        for(const spec of specs) uniqueSpecs.set(this.imageKey(version, spec.id, spec.components), spec);

        /** @type {Map<string, Buffer|null>} */
        const result = new Map();
        /** @type {string[]} */
        const missKeys = [];
        /** @type {ItemSpec[]} */
        const missSpecs = [];

        for(const [key, spec] of uniqueSpecs) {
            if(this.imageCache.has(key)) {
                const cached = this.touchImage(key);
                result.set(key, cached === this.UNRENDERABLE ? null : cached);
            }
            else {
                missKeys.push(key);
                missSpecs.push(spec);
            }
        }

        if(missSpecs.length) {
            const assets = await this.getPreparedAssets(version, interaction);
            const buffers = await this.renderItemGrid(missSpecs, assets, version);
            for(let i = 0; i < missSpecs.length; i++) {
                const key = missKeys[i];
                // `buffers === null` is a whole-render (GL) failure → don't cache negatives, let it retry.
                const buffer = buffers?.[i] ?? null;
                if(buffers) this.cacheImage(key, buffer ?? this.UNRENDERABLE);
                result.set(key, buffer);
            }
        }

        return new ItemImages(result);
    }

    /**
     * Builds the cache/result key for an item image. The `minecraft:` namespace is stripped so the same
     * item shares one cache entry regardless of how a caller spells it (`minecraft:stone` vs `stone`).
     * @param {string} [version] - The resolved version.
     * @param {string} id - The item id.
     * @param {Object} [components] - Item components affecting appearance (potion contents, etc.).
     * @returns {string} The key `version:id:componentsHash`.
     */
    static imageKey(version, id, components) {
        const normalizedId = id.replace(/^minecraft:/, '');
        const componentsHash = components && Object.keys(components).length ? JSON.stringify(components) : '';
        return `${version ?? ''}:${normalizedId}:${componentsHash}`;
    }

    /**
     * Gets the prepared assets for a version, downloading/extracting via {@link AssetsManager} on first
     * use and caching the `prepareAssets()` result per directory.
     * @private
     * @param {string} version - The server version.
     * @param {(import('discord.js').BaseInteraction & import('../../types/TranslatedResponses.js').TranslatedResponses)} [interaction] - Deferred interaction for the "downloading assets" embed.
     * @returns {Promise<PreparedAssets>} The prepared assets.
     * @throws {Error} If the version's assets can't be downloaded/extracted.
     */
    static async getPreparedAssets(version, interaction) {
        const dir = await AssetsManager.getAssets(version, interaction);
        let prepared = this.preparedCache.get(dir);
        if(!prepared) {
            prepared = await prepareAssets([dir]);
            this.preparedCache.set(dir, prepared);
        }
        return prepared;
    }

    /**
     * Resolves an item spec to the list of model references to render, branching on version.
     * - **{@link ItemRenderer.ITEM_DEFINITION_SINCE}+**: items are described by item-definition files, so
     *   {@link parseItemDefinition} walks the definition (honouring components — potion tint, dye, trims, …).
     * - **older (down to 1.8)**: no item definitions exist, so the model is resolved directly from
     *   `assets/<ns>/models/item/<id>.json`. `block-model-renderer` applies its own era-appropriate
     *   behaviour from the passed `version` (e.g. the pre-1.13 `block/` prefix, pre-1.19.3 atlas skip).
     * @private
     * @param {PreparedAssets} assets - Prepared assets.
     * @param {ItemSpec} spec - The item to resolve.
     * @param {string} version - The server's Minecraft version.
     * @returns {Promise<Array<Object>>} Model references for {@link resolveModelData} + {@link loadModel}.
     */
    static async resolveItemModels(assets, { id, components }, version) {
        if(compareMinecraftVersions(version, this.ITEM_DEFINITION_SINCE) >= 0)
            return parseItemDefinition(assets, id, { data: components ?? {}, display: this.GUI_DISPLAY, version });

        const [namespace, name] = id.includes(':') ? id.split(':') : ['minecraft', id];
        const model = namespace === 'minecraft' ? `item/${name}` : `${namespace}:item/${name}`;
        return [{ type: 'item', model, version }];
    }

    /**
     * Renders a list of items into one grid image in a single GL pass and crops each cell into its own
     * canonical-size PNG. Returns one entry per spec (`null` for an item that couldn't be rendered), or
     * `null` for the whole array if the render pass itself failed (so the caller skips negative caching).
     *
     * How the single-pass batch works: the items are packed into a `cols × rows` grid (`cols = ceil(√n)`),
     * each cell `CANONICAL_SIZE` px (times the supersample factor). One orthographic camera is set up so
     * 16 scene-units map to exactly one cell, and its frustum is widened to span the whole grid. Each
     * item's loaded `THREE.Group` is positioned at its cell's centre (pixel → scene-unit via `unitsPerPx`),
     * then the entire grid is drawn with a single {@link renderModelScene} call — one GL context for N
     * items instead of N. Finally each cell is cropped out of the returned image into its own PNG.
     * @private
     * @param {ItemSpec[]} specs - Items to render.
     * @param {PreparedAssets} assets - Prepared assets.
     * @param {string} [version] - The resolved version.
     * @returns {Promise<Array<Buffer|null>|null>} Per-spec PNG buffers (or `null`s), or `null` on a full render failure.
     */
    static async renderItemGrid(specs, assets, version) {
        try {
            // Lay the N items out like a contact sheet: a roughly-square grid of `cols x rows` cells,
            // one cell per item. E.g. 9 items -> 3x3, 10 items -> 4x3 (last row partly empty).
            const cols = Math.ceil(Math.sqrt(specs.length));
            const rows = Math.ceil(specs.length / cols);

            // Each cell is rendered at CANONICAL_SIZE * ss pixels, then shrunk back down to
            // CANONICAL_SIZE at crop time (see the crop loop below) — rendering bigger and shrinking is
            // what smooths out jagged edges (SSAA), `ss` being how much bigger.
            // But the *whole grid* (cols*cell by rows*cell) has to fit inside the headless-GL renderer's
            // max image size (MAX_RENDER_DIM), so `ss` is capped down from GRID_SUPERSAMPLE whenever a
            // large batch would otherwise exceed that limit (worst case ss=1, i.e. no smoothing).
            const ss = Math.max(1, Math.min(this.GRID_SUPERSAMPLE, Math.floor(this.MAX_RENDER_DIM / (Math.max(cols, rows) * this.CANONICAL_SIZE)) || 1));
            const cell = this.CANONICAL_SIZE * ss; // one cell's actual render size, in pixels
            const renderWidth = cols * cell; // full grid image width, in pixels
            const renderHeight = rows * cell; // full grid image height, in pixels

            // One shared 3D scene + camera for every item in this batch — items get added to `scene`
            // below, and the whole grid is rasterized in a single renderModelScene call further down.
            const { scene, camera } = makeModelScene();

            // Minecraft model space uses 16 units == 1 block/item's width. We're treating each grid cell
            // as "one item-sized space", so 16 scene-units == one cell == `cell` pixels — this ratio is
            // how a pixel position in the grid converts to a 3D position in the scene (used below).
            const unitsPerPx = 16 / cell;
            // By default the camera's visible area (its "frustum") is sized for a single item. Stretch
            // it out to exactly cover the whole grid (all cols*rows cells at once), in scene-units, so
            // one render call can see every item we're about to place, not just the first one.
            camera.left = -(renderWidth * unitsPerPx) / 2;
            camera.right = (renderWidth * unitsPerPx) / 2;
            camera.top = (renderHeight * unitsPerPx) / 2;
            camera.bottom = -(renderHeight * unitsPerPx) / 2;
            camera.fitAspect = false; // keep our frustum; don't let renderModelScene re-fit to aspect
            camera.updateProjectionMatrix();

            /** @type {Array<[number, number]|null>} grid (col,row) for items that loaded, else null */
            const cellOf = new Array(specs.length).fill(null);
            let rendered = 0;

            // Resolve + place every item's mesh into the shared scene before doing any actual rendering.
            for(let i = 0; i < specs.length; i++) {
                try {
                    // Find which model file(s) this item/version combination resolves to (see
                    // resolveItemModels) — an item can be made of more than one model (e.g. layered).
                    const models = await this.resolveItemModels(assets, specs[i], version);
                    if(!models.length) continue;

                    // This item's position in the grid, in (column, row) cell-index form.
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    // Convert "this cell's centre, in pixels from the grid's top-left" into "this cell's
                    // centre, in 3D scene-units from the grid's centre" (3D scenes are usually centred on
                    // (0,0), and +y points up while pixel rows count down, hence the flip on sceneY).
                    const sceneX = (col * cell + cell / 2 - renderWidth / 2) * unitsPerPx;
                    const sceneY = (renderHeight / 2 - (row * cell + cell / 2)) * unitsPerPx;

                    // Load each of this item's model(s) into a 3D mesh group and move it to sit exactly
                    // in the middle of its assigned grid cell.
                    for(const model of models) {
                        const resolved = await resolveModelData(assets, model);
                        const group = await loadModel(scene, assets, resolved, { display: this.GUI_DISPLAY, version });
                        group.position.set(sceneX, sceneY, 0);
                    }
                    cellOf[i] = [col, row]; // remember where this item ended up, for the crop step below
                    rendered++;
                }
                catch(err) {
                    // One item's model failing to load shouldn't abort the whole batch — it's just left
                    // out of the grid, and result[i] stays null (text fallback) for that item only.
                    logger.debug({ err: err?.message }, `Could not render item ${specs[i].id} for version ${version}`);
                }
            }

            /** @type {Array<Buffer|null>} */
            const result = new Array(specs.length).fill(null);
            if(!rendered) return result; // nothing loaded — skip the GL render entirely

            // The actual 3D render: one single call draws every placed item at once, producing one big
            // image containing the whole grid (this is the expensive headless-GL step we're batching to
            // avoid paying once per item).
            const buffer = await renderModelScene(scene, camera, { width: renderWidth, height: renderHeight, version });
            const gridImage = await Canvas.loadImage(buffer);

            // Cut the single grid image back apart into one small image per item, by copying each
            // item's cell rectangle out of `gridImage` into its own canvas.
            for(let i = 0; i < specs.length; i++) {
                if(!cellOf[i]) continue; // this item never got placed (failed above) — leave it null
                const [col, row] = cellOf[i];
                const cropCanvas = new Canvas.Canvas(this.CANONICAL_SIZE, this.CANONICAL_SIZE);
                const cropCtx = cropCanvas.getContext('2d');
                cropCtx.imageSmoothingEnabled = true; // downscale supersample → canonical
                // Source rect = this item's cell (at the supersampled `cell` size); destination rect =
                // the full crop canvas (at the final CANONICAL_SIZE) — drawImage does the shrink for us.
                cropCtx.drawImage(gridImage, col * cell, row * cell, cell, cell, 0, 0, this.CANONICAL_SIZE, this.CANONICAL_SIZE);
                result[i] = await cropCanvas.toBuffer('png');
            }

            return result;
        }
        catch(err) {
            // A failure here means the GL render call itself broke (not a single item) — e.g. context
            // creation failed. Returning null (vs. an array of nulls) tells the caller not to negative-
            // cache any of these items, since the failure wasn't really about them.
            trackError('unhandled', 'itemRenderer', null, null, err, `Could not render item grid for version ${version}`, logger);
            return null;
        }
    }

    /**
     * Marks a cache key as most-recently-used (re-inserts it at the tail) and returns its value.
     * @private
     * @param {string} key - The image cache key.
     * @returns {Buffer|symbol} The cached value (a buffer or the {@link ItemRenderer.UNRENDERABLE} sentinel).
     */
    static touchImage(key) {
        const value = this.imageCache.get(key);
        this.imageCache.delete(key);
        this.imageCache.set(key, value);
        return value;
    }

    /**
     * Inserts a rendered image (or the {@link ItemRenderer.UNRENDERABLE} sentinel) into the LRU, evicting
     * the oldest entry once the cache is full.
     * @private
     * @param {string} key - The image cache key.
     * @param {Buffer|symbol} value - The image buffer or unrenderable sentinel.
     */
    static cacheImage(key, value) {
        if(this.imageCache.size >= this.IMAGE_CACHE_MAX) {
            const oldest = this.imageCache.keys().next().value;
            if(oldest !== undefined) this.imageCache.delete(oldest);
        }
        this.imageCache.set(key, value);
    }
}
