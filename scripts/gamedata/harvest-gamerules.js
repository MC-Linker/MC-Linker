import { pathToFileURL } from 'node:url';
import WikiApi from './wiki-api.js';

/**
 * Stage 1 of the game data pipeline: capture the raw wikitext of the game rule tables into
 * `resources/data/gamerules/raw/`.
 *
 * Nothing is parsed here. Capturing separately means parsing runs offline and deterministically against a
 * pinned set of revisions, and two harvests can be diffed to see exactly what the wiki changed.
 *
 * The wiki is the source for game rule *defaults* only. Rule names come from the client jar's language
 * file, which is authoritative and version-exact — defaults are compiled into `GameRules.class` as
 * bytecode operands and cannot be read out of the jar.
 *
 * Run with: `node scripts/gamedata/harvest-gamerules.js`
 */
export default class GameRuleHarvester {

    /** @type {string} */
    static PAGE = 'Game rule';

    /**
     * Headings of the per-category rule tables under "List of game rules".
     *
     * Section indices are resolved by heading text at runtime rather than hardcoded, because the wiki
     * renumbers sections whenever one is inserted.
     * @type {string[]}
     */
    static TABLE_SECTIONS = ['Chat', 'Drops', 'Miscellaneous', 'Mobs', 'Player', 'Spawning', 'World Updates'];

    /**
     * Heading of the Java Edition history section, which carries the 26.1 rename table mapping the old
     * camelCase rule names to the current resource-location ids. The heading is italicised on the wiki, so
     * the raw line contains markup rather than a bare title.
     * @type {string}
     */
    static HISTORY_SECTION = '<i>Java Edition</i>';

    /**
     * Captures every configured section of {@link GameRuleHarvester.PAGE} into the raw store.
     * @returns {Promise<{ slug: string, section: string, revid: number }[]>} One entry per captured section.
     * @throws {Error} If the page or any configured section cannot be fetched, or a heading is missing.
     */
    static async harvest() {
        const sections = await WikiApi.getSections(this.PAGE);
        const wanted = [...this.TABLE_SECTIONS, this.HISTORY_SECTION];
        const captured = [];

        for(const heading of wanted) {
            const section = sections.find(s => s.line === heading);
            if(!section) throw new Error(`Section "${heading}" not found on "${this.PAGE}" — the wiki page structure changed`);

            const capture = await WikiApi.getWikitext(this.PAGE, section.index);
            if(!capture) throw new Error(`Page "${this.PAGE}" does not exist`);

            const slug = WikiApi.slugify(this.PAGE, heading);
            await WikiApi.saveRaw(slug, { ...capture, heading });
            captured.push({ slug, section: heading, revid: capture.revid });
        }

        return captured;
    }

    /**
     * Reads every captured section back out of the raw store.
     * @returns {Promise<{ tables: Object<string, string>, history: string }>} Table wikitext keyed by heading, plus the history wikitext.
     * @throws {Error} If a capture is missing — run the harvest first.
     */
    static async readCaptures() {
        /** @type {Object<string, string>} */
        const tables = {};

        for(const heading of this.TABLE_SECTIONS) {
            const capture = await WikiApi.readRaw(WikiApi.slugify(this.PAGE, heading));
            if(!capture) throw new Error(`No capture for section "${heading}" — run node scripts/gamedata/harvest-gamerules.js first`);
            tables[heading] = capture.wikitext;
        }

        const history = await WikiApi.readRaw(WikiApi.slugify(this.PAGE, this.HISTORY_SECTION));
        if(!history) throw new Error('No capture for the history section — run node scripts/gamedata/harvest-gamerules.js first');

        return { tables, history: history.wikitext };
    }
}

// Only run when invoked directly, so the generator can import the reader without triggering a harvest.
// pathToFileURL rather than a string compare: on Windows the module url is `file:///C:/...`.
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const captured = await GameRuleHarvester.harvest();
    for(const { slug, section, revid } of captured) console.log(`Captured "${section}" (revid ${revid}) -> ${slug}.json`);
}
