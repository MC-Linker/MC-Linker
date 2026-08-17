/**
 * Stage 2 of the game data pipeline: parse the captured game rule wikitext offline.
 *
 * Only the data the jar cannot provide is taken from the wiki — the default value, its type, and the 26.1
 * rename table. Display names and descriptions come from the client jar's language file, which is
 * authoritative and version-exact, so they are deliberately not parsed here.
 */
export default class GameRuleParser {

    /**
     * Matches a rule id inside the `{{va|...}}` template the name column wraps every id in.
     * @type {RegExp}
     */
    static ID_PATTERN = /\{\{va\|([a-z0-9_]+)\}\}/i;

    /**
     * Matches a value inside the `{{cd|...}}` code template, used for both defaults and rename entries.
     * @type {RegExp}
     */
    static VALUE_PATTERN = /\{\{cd\|([^}|]+)\}\}/;

    /**
     * Matches one row of the 26.1 rename list, `* {{cd|old}} &rarr; {{cd|new}}`.
     * @type {RegExp}
     */
    static RENAME_PATTERN = /^\*\s*\{\{cd\|([^}|]+)\}\}\s*(?:&rarr;|→)\s*\{\{cd\|([^}|]+)\}\}/;

    /**
     * Splits a wikitable into rows of raw cell strings.
     *
     * Rows are delimited by a lone `|-` and cells by a leading `|` at the start of a line, so `|` inside a
     * template (`{{cd|true}}`) is never mistaken for a cell break. Lines that start with neither are
     * continuations of the preceding cell — the Type column uses them for its `min:`/`max:` bounds.
     * @param {string} wikitext - The wikitext of a section containing exactly one table.
     * @returns {string[][]} One array of cell strings per row.
     */
    static parseRows(wikitext) {
        /** @type {string[][]} */
        const rows = [];
        /** @type {?string[]} */
        let current = null;

        for(const line of wikitext.split('\n')) {
            const trimmed = line.trim();

            if(trimmed === '|-') {
                if(current) rows.push(current);
                current = [];
            }
            else if(current === null) continue; // header rows, before the first `|-`
            else if(trimmed === '|}') {
                rows.push(current);
                current = null;
            }
            else if(line.startsWith('|')) current.push(line.slice(1));
            else if(current.length) current[current.length - 1] += `\n${line}`;
        }

        if(current) rows.push(current);
        return rows;
    }

    /**
     * Picks the Java Edition fragment out of a cell that may carry a Java and a Bedrock variant.
     *
     * Cells split the two with `<br>` and label them `{{el|je}}`/`{{el|be}}` in the name column and
     * `{{only|je}}`/`{{only|be}}` in the default column. A cell with no labels at all is Java-only.
     * @param {string} cell - The raw cell string.
     * @returns {string} The Java Edition fragment, or the whole cell when it is not split.
     */
    static javaFragment(cell) {
        const fragments = cell.split(/<br\s*\/?>/i);
        if(fragments.length === 1) return cell;

        return fragments.find(f => /\{\{(?:el|only)\|je/i.test(f))
            ?? fragments.find(f => !/\{\{(?:el|only)\|be/i.test(f))
            ?? cell;
    }

    /**
     * Reads the rule type out of the Type cell.
     *
     * The cell carries its `min:`/`max:` bounds on continuation lines, and some rows append an edition
     * marker template to the type itself (`Bool{{only|JE|short=1}}<br>`), so templates and tags are
     * stripped before the type is read.
     * @param {string} cell - The raw Type cell.
     * @returns {string} The bare type name.
     */
    static parseType(cell) {
        return cell.trim().split('\n')[0]
            .replace(/\{\{[^}]*\}\}/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();
    }

    /**
     * Coerces a raw default value to the JS type named by the Type column.
     * @param {string} raw - The default as written on the wiki.
     * @param {string} type - The rule type (`Bool` or `Int`).
     * @returns {boolean|number} The coerced default.
     * @throws {Error} If the type is not one this pipeline knows, or an `Int` default is non-numeric. Both mean the wiki changed shape and the parser needs updating rather than silently producing a wrong default.
     */
    static coerceDefault(raw, type) {
        if(type === 'Bool') {
            if(raw !== 'true' && raw !== 'false') throw new Error(`Non-boolean default "${raw}" for a Bool rule`);
            return raw === 'true';
        }
        if(type === 'Int') {
            const value = Number(raw);
            if(!Number.isFinite(value)) throw new Error(`Non-numeric default "${raw}" for an Int rule`);
            return value;
        }
        throw new Error(`Unknown game rule type "${type}"`);
    }

    /**
     * Parses the per-category rule tables into their defaults.
     * @param {Object<string, string>} tables - Table wikitext keyed by category heading.
     * @returns {{ id: string, type: string, default: (boolean|number|string), category: string }[]} One entry per rule.
     * @throws {Error} If a row has a default that cannot be coerced to its declared type.
     */
    static parseTables(tables) {
        const rules = [];

        for(const [category, wikitext] of Object.entries(tables)) {
            for(const cells of this.parseRows(wikitext)) {
                if(cells.length < 4) continue;

                const id = this.javaFragment(cells[0]).match(this.ID_PATTERN)?.[1];
                const rawDefault = this.javaFragment(cells[2]).match(this.VALUE_PATTERN)?.[1];
                const type = this.parseType(cells[3]);
                if(!id || rawDefault === undefined) continue;

                rules.push({
                    id,
                    type,
                    default: this.coerceDefault(rawDefault.trim(), type),
                    category: category.toLowerCase().replace(/ /g, '_'),
                });
            }
        }

        return rules;
    }

    /**
     * Parses the 26.1 rename table out of the history section.
     *
     * 26.1 moved the game rules into a registry, renaming them from camelCase to resource locations. Many
     * were not just re-cased but renamed outright (`doTileDrops` -> `block_drops`), and three had their
     * meaning inverted, so a world written before 26.1 stores both a different key *and* — for those
     * three — the opposite value.
     * @param {string} wikitext - The Java Edition history wikitext.
     * @returns {Object<string, { id: string, inverted: boolean }>} The modern id (and inversion) keyed by old name.
     */
    static parseRenames(wikitext) {
        /** @type {Object<string, { id: string, inverted: boolean }>} */
        const renames = {};
        let last = null;

        for(const line of wikitext.split('\n')) {
            const trimmed = line.trim();
            const match = trimmed.match(this.RENAME_PATTERN);

            if(match) {
                last = { id: match[2].trim(), inverted: false };
                renames[match[1].trim()] = last;
            }
            // The inversion note is a sub-bullet of the rename it belongs to.
            else if(last && trimmed.startsWith('**')) {
                if(/inverted/i.test(trimmed)) last.inverted = true;
            }
            else last = null;
        }

        return renames;
    }
}
