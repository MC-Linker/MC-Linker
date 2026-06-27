import Canvas from 'skia-canvas';
import { drawFittedText, drawMinecraftNumber } from '../../utilities/utils.js';
import ItemRenderer from './ItemRenderer.js';

/**
 * Composites Minecraft container images (player inventory, shulker boxes) onto a canvas.
 * Item icons are 3D models from the server's version assets, obtained via {@link ItemRenderer.getItemImages}.
 */
export default class ContainerRenderer {

    /**
     * @typedef {object} ContainerRenderOptions
     * @property {(item: object, index: number) => void} [loopCode] - Runs per slotted item (e.g. to build a button per item).
     * @property {import('minecraft-data').IndexedData} mcData - Minecraft data for the server version.
     * @property {import('../../utilities/logger/Logger.js').default} [logger] - Per-execution child logger.
     */
    /** @typedef {{ canvas: Canvas.Canvas, ctx: Canvas.CanvasRenderingContext2D }} RenderedContainer - A rendered container canvas and its context. */

    static SLOT_ICON_SIZE = 32;
    // The background image and slot coordinates are version-dependent (the inventory GUI has changed
    // across versions). A later phase moves these behind the per-version registry, which will own
    // `inventoryBackground(version)` + `slotCoords(version)` — possibly more than one coordinate set.
    static INVENTORY_BACKGROUND = './resources/images/containers/inventory_blank.png';
    static SHULKER_BACKGROUND = './resources/images/containers/shulker_blank.png';

    mainInvSlotCoords = {
        9: [16, 168],
        10: [52, 168],
        11: [88, 168],
        12: [124, 168],
        13: [160, 168],
        14: [196, 168],
        15: [232, 168],
        16: [268, 168],
        17: [304, 168],
        18: [16, 204],
        19: [52, 204],
        20: [88, 204],
        21: [124, 204],
        22: [160, 204],
        23: [196, 204],
        24: [232, 204],
        25: [268, 204],
        26: [304, 204],
        27: [16, 240],
        28: [52, 240],
        29: [88, 240],
        30: [124, 240],
        31: [160, 240],
        32: [196, 240],
        33: [232, 240],
        34: [268, 240],
        35: [304, 240],
    };

    hotbarSlotCoords = {
        36: [16, 284],
        37: [52, 284],
        38: [88, 284],
        39: [124, 284],
        40: [160, 284],
        41: [196, 284],
        42: [232, 284],
        43: [268, 284],
        44: [304, 284],
    };

    armorSlotCoords = {
        5: [16, 16],
        6: [16, 52],
        7: [16, 88],
        8: [16, 124],
        45: [154, 124],
    };

    //Construct shulkerSlotCoords from player inventory
    shulkerSlotCoords = Object.assign(
        //Move mainInvSlotCoords up by 132 and decrease slot number by 9
        Object.fromEntries(Object.entries(this.mainInvSlotCoords)
            .map(([slot, [x, y]]) => [slot - 9, [x, y - 132]])),
        //Increase slot numbers by 18
        Object.fromEntries(Object.entries(Object.assign({}, this.mainInvSlotCoords, this.hotbarSlotCoords))
            .map(([slot, [x, y]]) => [+slot + 18, [x, y]])),
    );

    /**
     * @param {string} version - The server's Minecraft version; the renderer downloads/prepares its assets itself.
     * @param {(import('discord.js').BaseInteraction & import('../../types/TranslatedResponses.js').TranslatedResponses)} [interaction] - Deferred interaction, edited with a "downloading assets" step embed on the first render of an uncached version.
     */
    constructor(version, interaction = null) {
        /** @type {string} */
        this.version = version;
        /** @type {?(import('discord.js').BaseInteraction & import('../../types/TranslatedResponses.js').TranslatedResponses)} */
        this.interaction = interaction;
    }

    /**
     * Renders the full player inventory (main inventory + armor + hotbar).
     * @param {object[]} items - Inventory items (network-slot normalized).
     * @param {ContainerRenderOptions} options - Render options.
     * @returns {Promise<RenderedContainer>} The rendered canvas and its context.
     * @throws {Error} If the version's assets can't be downloaded/prepared.
     */
    async renderInventory(items, options) {
        const slotCoords = Object.assign({}, this.mainInvSlotCoords, this.armorSlotCoords, this.hotbarSlotCoords);
        return this._renderContainer(ContainerRenderer.INVENTORY_BACKGROUND, items, slotCoords, options);
    }

    /**
     * Renders a shulker box's contents (shulker inventory + surrounding player inventory preview).
     * @param {object[]} items - Shulker + inventory items (shulker-slot normalized).
     * @param {ContainerRenderOptions} options - Render options.
     * @returns {Promise<RenderedContainer>} The rendered canvas and its context.
     * @throws {Error} If the version's assets can't be downloaded/prepared.
     */
    async renderShulker(items, options) {
        return this._renderContainer(ContainerRenderer.SHULKER_BACKGROUND, items, this.shulkerSlotCoords, options);
    }

    /**
     * Draws a container background and its items onto a canvas. All renderable items are drawn in a single
     * batched GPU pass; items that fail render as fitted text in their slot. Item counts, durability bars
     * and the per-item `loopCode` are then drawn on top.
     * @private
     * @param {string} backgroundPath - Path to the container background image.
     * @param {object[]} items - The items to draw, each with `slot`, `id`, `count`, optional `tag`/`components`.
     * @param {{ [slot: number]: [number, number] }} slotCoords - Slot → top-left coordinate map.
     * @param {ContainerRenderOptions} options - Render options.
     * @returns {Promise<RenderedContainer>} The rendered canvas and its context.
     * @throws {Error} If the version's assets can't be downloaded/prepared.
     */
    async _renderContainer(backgroundPath, items, slotCoords, { loopCode = () => {}, mcData, logger = null } = {}) {
        const background = await Canvas.loadImage(backgroundPath);
        const canvas = new Canvas.Canvas(background.width, background.height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Collect slotted items, and a spec per renderable item (getItemImages dedupes).
        /** @type {Array<{ item: object, index: number, x: number, y: number, itemId: string, key: ?string }>} */
        const slotted = [];
        /** @type {Array<{ id: string, components?: Object }>} */
        const specs = [];
        for(let i = 0; i < items.length; i++) {
            const [x, y] = slotCoords[items[i].slot] ?? [];
            if(!x || !y) continue; //Skip modded/unknown slots

            const itemId = items[i].id.split(':').pop();
            const components = itemId === 'air' ? undefined : this._potionComponents(items[i], itemId);
            const key = itemId === 'air' ? null : ItemRenderer.imageKey(this.version, items[i].id, components);
            slotted.push({ item: items[i], index: i, x, y, itemId, key });

            if(key) specs.push({ id: items[i].id, components });
        }

        const itemImages = await ItemRenderer.getItemImages(specs, this.version, this.interaction);

        for(const { item, index, x, y, itemId, key } of slotted) {
            if(itemId !== 'air' && !await itemImages.draw(ctx, key, x, y, ContainerRenderer.SLOT_ICON_SIZE)) {
                logger?.debug(`Could not render item ${itemId}. Applying text...`);
                drawFittedText(ctx, mcData.itemsByName[itemId]?.displayName ?? itemId, x, y, ContainerRenderer.SLOT_ICON_SIZE, ContainerRenderer.SLOT_ICON_SIZE, { maxFontSize: 9 });
            }

            //Draw count
            const count = item.count;
            if(count > 1) drawMinecraftNumber(ctx, count, x, y + 16, 10, 14);

            //Draw durability bar
            const damage = item.tag?.Damage;
            const maxDurability = mcData.itemsByName[itemId]?.maxDurability;
            if(damage && maxDurability) {
                const durabilityPercent = 100 - damage / maxDurability * 100;
                const durabilityPx = Math.floor(durabilityPercent / 100 * 34);

                //Get gradient color between green and red
                const r = Math.floor((100 - durabilityPercent) * 2.56);
                const g = Math.floor(durabilityPercent * 2.56);
                const rgb = [r, g, 0];

                ctx.strokeStyle = `rgb(${rgb.join(',')})`;
                ctx.fillStyle = `rgb(${rgb.join(',')})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, y + 28);
                ctx.lineTo(x + durabilityPx, y + 28);
                ctx.stroke();
                ctx.closePath();

                ctx.strokeStyle = `#000000`;
                ctx.fillStyle = `#000000`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, y + 31);
                ctx.lineTo(x + 33, y + 31);
                ctx.stroke();
                ctx.closePath();
            }

            loopCode(item, index);
        }

        return { canvas, ctx };
    }

    /**
     * Builds the `minecraft:potion_contents` component for potion items so the renderer applies the
     * correct potion tint, or returns `undefined` for non-potion items.
     * @private
     * @param {object} item - The inventory item (`components`/`tag`).
     * @param {string} itemId - The namespace-stripped item id.
     * @returns {{ 'minecraft:potion_contents': { potion: string } }|undefined} The potion component, or `undefined`.
     */
    _potionComponents(item, itemId) {
        if(itemId !== 'potion' && itemId !== 'splash_potion' && itemId !== 'lingering_potion') return undefined;

        const potionId = item.components?.['minecraft:potion_contents']?.potion ?? item.tag?.Potion;
        if(!potionId) return undefined;

        const namespaced = potionId.includes(':') ? potionId : `minecraft:${potionId}`;
        return { 'minecraft:potion_contents': { potion: namespaced } };
    }
}
