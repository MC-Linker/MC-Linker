import fs from 'fs-extra';
import path from 'path';

/**
 * Thin client for the minecraft.wiki MediaWiki API, plus the raw-capture store used by the game data
 * pipeline.
 *
 * Every fetch is persisted to {@link WikiApi.RAW_DIR} together with the revision id it came from, so the
 * parsing and generation steps never touch the network and one harvest can be diffed against a later one.
 */
export default class WikiApi {

    /** @type {string} */
    static API = 'https://minecraft.wiki/api.php';

    /** @type {string} */
    static RAW_DIR = 'resources/data/gamerules/raw';

    /**
     * Identifies the harvester to the wiki. Anonymous bulk scraping is what gets tools rate-limited, so
     * this points back at the project.
     * @type {string}
     */
    static USER_AGENT = 'MC-Linker-GameData-Harvester/1.0 (+https://github.com/MC-Linker/MC-Linker)';

    /**
     * Delay between requests, in milliseconds. This harvest only fetches a handful of sections, but the
     * wiki is community-run and the courtesy costs nothing.
     * @type {number}
     */
    static REQUEST_DELAY_MS = 150;

    /** @type {number} */
    static MAX_RETRIES = 3;

    /**
     * @type {number}
     * @private
     */
    static _lastRequestAt = 0;

    /**
     * Performs a rate-limited GET against the wiki API.
     * @param {Object<string, string>} params - Query parameters, excluding `format`/`formatversion`.
     * @returns {Promise<Object>} The parsed JSON response.
     * @throws {Error} If the request fails after {@link WikiApi.MAX_RETRIES} attempts, or the API returns an error object.
     */
    static async get(params) {
        const url = new URL(this.API);
        for(const [key, value] of Object.entries({ ...params, format: 'json', formatversion: '2' })) {
            url.searchParams.set(key, value);
        }

        for(let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            const sinceLast = Date.now() - this._lastRequestAt;
            if(sinceLast < this.REQUEST_DELAY_MS) await new Promise(r => setTimeout(r, this.REQUEST_DELAY_MS - sinceLast));
            this._lastRequestAt = Date.now();

            try {
                const res = await fetch(url, { headers: { 'User-Agent': this.USER_AGENT } });
                if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

                const json = await res.json();
                if(json.error) throw new Error(`API error: ${json.error.code} - ${json.error.info}`);
                return json;
            }
            catch(err) {
                if(attempt === this.MAX_RETRIES) throw new Error(`Failed to fetch ${url}: ${err.message}`);
                await new Promise(r => setTimeout(r, 500 * attempt));
            }
        }
    }

    /**
     * Lists the sections of a page.
     * @param {string} page - The page title.
     * @returns {Promise<{ index: string, line: string, level: string }[]>} The page's sections.
     * @throws {Error} If the page does not exist or the request fails.
     */
    static async getSections(page) {
        const json = await this.get({ action: 'parse', page, prop: 'sections', redirects: '1' });
        return json.parse.sections;
    }

    /**
     * Fetches the wikitext of a page, or of a single section of it.
     * @param {string} page - The page title.
     * @param {?string} [section=null] - The section index to fetch, or null for the whole page.
     * @returns {Promise<?{ page: string, section: ?string, revid: number, wikitext: string }>} The capture, or null if the page does not exist.
     * @throws {Error} If the request fails for a reason other than a missing page.
     */
    static async getWikitext(page, section = null) {
        const params = { action: 'parse', page, prop: 'wikitext|revid', redirects: '1' };
        if(section !== null) params.section = section;

        try {
            const json = await this.get(params);
            return {
                page: json.parse.title,
                section,
                revid: json.parse.revid,
                wikitext: json.parse.wikitext,
            };
        }
        catch(err) {
            if(err.message.includes('missingtitle')) return null;
            throw err;
        }
    }

    /**
     * Converts a page title (and optional section label) into a filesystem-safe slug.
     * @param {string} page - The page title.
     * @param {?string} [label=null] - An optional section label to append.
     * @returns {string} The slug.
     */
    static slugify(page, label = null) {
        const clean = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return label ? `${clean(page)}.${clean(label)}` : clean(page);
    }

    /**
     * Persists a capture to the raw store.
     * @param {string} slug - The slug to store it under.
     * @param {{ page: string, section: ?string, revid: number, wikitext: string }} capture - The capture.
     * @returns {Promise<string>} The path the capture was written to.
     * @throws {Error} If the file cannot be written.
     */
    static async saveRaw(slug, capture) {
        await fs.ensureDir(this.RAW_DIR);

        const file = path.join(this.RAW_DIR, `${slug}.json`);
        await fs.writeJson(file, { ...capture, harvestedAt: new Date().toISOString() }, { spaces: 2 });
        return file;
    }

    /**
     * Reads a capture back from the raw store.
     * @param {string} slug - The slug it was stored under.
     * @returns {Promise<?{ page: string, section: ?string, revid: number, wikitext: string, harvestedAt: string }>} The capture, or null if absent.
     * @throws {Error} If the file exists but cannot be read or parsed.
     */
    static async readRaw(slug) {
        const file = path.join(this.RAW_DIR, `${slug}.json`);
        if(!await fs.pathExists(file)) return null;
        return await fs.readJson(file);
    }
}
