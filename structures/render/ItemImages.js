import Canvas from 'skia-canvas';

/**
 * A set of rendered item icons keyed by image key, returned by `ItemRenderer.getItemImages`.
 * Decodes each buffer to an `Image` at most once and composites it onto a canvas, so callers don't
 * repeat the decode-cache + smoothing boilerplate.
 */
export default class ItemImages {

    /**
     * @param {Map<string, Buffer|null>} buffers - Image key → canonical-size PNG buffer (or `null` if unrenderable).
     */
    constructor(buffers) {
        /**
         * @private
         * @type {Map<string, Buffer|null>}
         */
        this.buffers = buffers;
        /**
         * Decoded image per key (each buffer is decoded at most once).
         * @private
         * @type {Map<string, ?Canvas.Image>}
         */
        this.decoded = new Map();
    }

    /**
     * Composites the cached icon for `key` into the box `(x, y, size, size)`. 3D renders downscale better
     * smoothed, so smoothing is enabled for the blit and the previous state restored afterwards. Returns
     * `false` when there is no image for the key, so the caller can draw a text fallback instead.
     * @param {Canvas.CanvasRenderingContext2D} ctx - The target canvas context.
     * @param {string} key - The image key (from `AssetsManager.imageKey`).
     * @param {number} x - Box top-left x.
     * @param {number} y - Box top-left y.
     * @param {number} size - Box width/height in px.
     * @returns {Promise<boolean>} `true` if an image was drawn, `false` if none exists.
     */
    async draw(ctx, key, x, y, size) {
        let image = this.decoded.get(key);
        if(image === undefined) {
            const buffer = this.buffers.get(key);
            image = buffer ? await Canvas.loadImage(buffer) : null;
            this.decoded.set(key, image);
        }
        if(!image) return false;

        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(image, x, y, size, size);
        ctx.imageSmoothingEnabled = prevSmoothing;
        return true;
    }
}
