import { stripNamespace, toCamelCase } from '../../utilities/format-utils.js';

/**
 * Derives advancements, custom statistics and game rules from an official Minecraft client jar.
 *
 * Pure — jar IO belongs to {@link import('./MinecraftAssetsManager.js').default} — so the same code
 * produces the committed baselines and a connected server's runtime data. Game rule defaults are the
 * exception: they are bytecode operands in `GameRules.class`, so the caller passes in harvested ones.
 */
export default class GameDataDeriver {

    /** @typedef {{ path: string, json: Object }} AdvancementFile - One advancement, its path relative to the advancement directory (`story/mine_stone`) and its parsed contents. */
    /** @typedef {{ name: string, value: string, description: string, icon: string, type: string, components?: Object, children: string[] }} Advancement */
    /** @typedef {{ name: string, value: string }} CustomStat */
    /** @typedef {{ id: string, legacyName: ?string, inverted: boolean, type: string, default: (boolean|number), name: string, description: ?string }} GameRule */
    /** @typedef {{ advancements: Object<string, Advancement[]>, customStats: CustomStat[], gameRules: GameRule[] }} GameData - Everything derived from one version's jar. */

    /** Prefix every custom statistic's display name is stored under in the language file. */
    static CUSTOM_STAT_PREFIX = 'stat.minecraft.';

    /** Frame used by advancements that do not declare one. */
    static DEFAULT_FRAME = 'task';

    /**
     * Category order, matching the in-game advancement tabs. The jar yields them alphabetically, which
     * would otherwise reorder the generated file for no reason.
     * @type {string[]}
     */
    static CATEGORY_ORDER = ['story', 'nether', 'end', 'adventure', 'husbandry'];

    /**
     * Resolves a Minecraft text component to its English string. Advancement titles are usually
     * `{ translate }`, but occasionally a bare string or a `fallback`-carrying component.
     * @param {Object|string|Array|undefined} component - The raw component.
     * @param {Object<string, string>} lang - The language map.
     * @returns {?string} The resolved text, or null when the component carries none.
     */
    static translate(component, lang) {
        if(typeof component === 'string') return component;
        if(!component || typeof component !== 'object') return null;
        if(Array.isArray(component)) return component.map(part => this.translate(part, lang) ?? '').join('');
        if(component.translate) return lang[component.translate] ?? component.fallback ?? component.translate;
        if(typeof component.text === 'string') return component.text;
        return null;
    }

    /**
     * Derives the advancement tree, keyed by category.
     *
     * Only advancements with a `display` block are tree entries; the rest are recipe unlocks. Titles use
     * the `translate` key stored in the file, never one rebuilt from its path — a few do not match.
     * @param {AdvancementFile[]} files - Every advancement file in the jar.
     * @param {Object<string, string>} lang - The language map.
     * @returns {Object<string, Advancement[]>} Advancements per category, root first, then breadth-first.
     */
    static deriveAdvancements(files, lang) {
        /** @type {Object<string, Map<string, Object>>} */
        const categories = {};

        for(const { path, json } of files) {
            if(!json.display) continue;

            const [category, ...rest] = path.split('/');
            const value = rest.join('/');
            if(!value) continue;

            const parentPath = json.parent ? stripNamespace(json.parent) : null;
            const icon = json.display.icon ?? {};

            (categories[category] ??= new Map()).set(value, {
                name: this.translate(json.display.title, lang),
                value,
                description: this.translate(json.display.description, lang),
                // `item` is the pre-1.20.5 spelling of `id`. Its sibling `nbt` is the legacy item-tag
                // format, not the component map the renderer takes, so it is ignored.
                icon: stripNamespace(icon.id ?? icon.item ?? ''),
                type: json.display.frame ?? this.DEFAULT_FRAME,
                // Without these the dyed-banner and decorated-pot icons render blank.
                ...(icon.components ? { components: icon.components } : {}),
                // Kept out of the output; only used to build `children` below.
                parent: parentPath?.startsWith(`${category}/`) ? parentPath.slice(category.length + 1) : null,
            });
        }

        /** @type {Object<string, Advancement[]>} */
        const result = {};
        // Known tabs first, in their in-game order; anything new the game adds is appended.
        const ordered = Object.keys(categories).sort((a, b) => {
            const rank = category => (this.CATEGORY_ORDER.indexOf(category) + 1 || this.CATEGORY_ORDER.length + 1);
            return rank(a) - rank(b) || a.localeCompare(b);
        });
        for(const category of ordered) result[category] = this.orderCategory(categories[category]);

        return result;
    }

    /**
     * Inverts one category's `parent` links into `children`, ordered root first then breadth-first.
     * @private
     * @param {Map<string, Object>} nodes - The category's advancements by value.
     * @returns {Advancement[]} The ordered advancements.
     */
    static orderCategory(nodes) {
        /** @type {Map<string, string[]>} */
        const children = new Map([...nodes.keys()].map(value => [value, []]));
        for(const [value, node] of nodes) {
            if(node.parent && children.has(node.parent)) children.get(node.parent).push(value);
        }
        for(const list of children.values()) list.sort((a, b) => a.localeCompare(b));

        const roots = nodes.has('root') ? ['root'] : [...nodes.keys()].filter(value => !nodes.get(value).parent);
        const queue = [...roots];
        const seen = new Set(queue);
        const ordered = [];

        const push = value => {
            const { parent, ...node } = nodes.get(value);
            ordered.push({ ...node, children: children.get(value) });
        };

        while(queue.length) {
            const value = queue.shift();
            push(value);

            for(const child of children.get(value)) {
                if(seen.has(child)) continue;
                seen.add(child);
                queue.push(child);
            }
        }

        // An advancement parented into another category is unreachable from this root, but still belongs.
        for(const value of nodes.keys()) {
            if(seen.has(value)) continue;
            push(value);
        }

        return ordered;
    }

    /**
     * Derives the custom statistics — the only stat category not already covered by `minecraft-data`.
     * @param {Object<string, string>} lang - The language map.
     * @returns {CustomStat[]} The custom stats, sorted by display name.
     */
    static deriveCustomStats(lang) {
        return Object.keys(lang)
            .filter(key => key.startsWith(this.CUSTOM_STAT_PREFIX))
            .map(key => ({ name: lang[key], value: key.slice(this.CUSTOM_STAT_PREFIX.length) }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Extracts the pre-26.1 name of every renamed game rule from the jar's deprecated-key map
     * (`gamerule.doTileDrops` -> `gamerule.minecraft.block_drops`).
     *
     * The three rules whose meaning was *inverted* in 26.1 are the exception — the jar lists those as
     * removed rather than renamed, so their old names come from the wiki instead.
     * @param {{ renamed?: Object<string, string> }} deprecated - The parsed `deprecated.json`.
     * @returns {Map<string, string>} The pre-26.1 name, keyed by modern rule id.
     */
    static gameRuleLegacyNames(deprecated) {
        const prefix = 'gamerule.';
        const modernPrefix = 'gamerule.minecraft.';

        /** @type {Map<string, string>} */
        const legacyNames = new Map();
        for(const [from, to] of Object.entries(deprecated.renamed ?? {})) {
            if(!from.startsWith(prefix) || !to.startsWith(modernPrefix)) continue;
            legacyNames.set(to.slice(modernPrefix.length), from.slice(prefix.length));
        }

        return legacyNames;
    }

    /**
     * Finds the language key holding a game rule's display name in a given version.
     *
     * The language file only partly followed 26.1's rename: some rules moved to `gamerule.minecraft.<id>`,
     * most kept their camelCase key, and renamed ones kept their old name's key. All spellings are tried.
     * @param {string} id - The modern rule id.
     * @param {?string} legacyName - The pre-26.1 name, if the rule was renamed.
     * @param {Object<string, string>} lang - The language map.
     * @returns {?string} The language key, or null when the rule does not exist in this version.
     */
    static gameRuleLangKey(id, legacyName, lang) {
        const candidates = [`gamerule.minecraft.${id}`, `gamerule.${toCamelCase(id)}`];
        if(legacyName) candidates.push(`gamerule.${legacyName}`, `gamerule.${toCamelCase(legacyName)}`);

        return candidates.find(key => lang[key] !== undefined) ?? null;
    }

    /**
     * Derives the game rules of a version, merging the harvested defaults with the jar's names. A rule
     * with no language key did not exist in this version and is dropped.
     * @param {Object<string, string>} lang - The language map.
     * @param {{ id: string, legacyName: ?string, inverted: boolean, type: string, default: (boolean|number) }[]} defaults - The harvested defaults.
     * @returns {GameRule[]} The rules of this version, sorted by id.
     */
    static deriveGameRules(lang, defaults) {
        const rules = [];

        for(const rule of defaults) {
            const key = this.gameRuleLangKey(rule.id, rule.legacyName, lang);
            if(!key) continue;

            rules.push({
                id: rule.id,
                legacyName: rule.legacyName ?? null,
                inverted: rule.inverted ?? false,
                type: rule.type,
                default: rule.default,
                name: lang[key],
                description: lang[`${key}.description`] ?? null,
            });
        }

        return rules.sort((a, b) => a.id.localeCompare(b.id));
    }
}
