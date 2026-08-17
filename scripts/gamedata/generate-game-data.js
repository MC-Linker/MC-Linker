import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';
import GameRuleHarvester from './harvest-gamerules.js';
import GameRuleParser from './gamerule-parser.js';
import AssetsManager from '../../structures/render/MinecraftAssetsManager.js';
import GameDataDeriver from '../../structures/render/GameDataDeriver.js';

/**
 * Stage 3 of the game data pipeline: regenerate the committed baselines in `resources/data/` from the
 * latest Minecraft release.
 *
 * These three files used to be hand-authored and drifted badly — by 26.2 they were missing 13
 * advancements, 6 game rules and a custom statistic. They are now generated, and serve as the fallback
 * for callers that cannot wait on a jar download; a connected server's exact version is resolved at
 * runtime by {@link AssetsManager.getGameData} using the very same derivation.
 *
 * Run `node scripts/gamedata/harvest-gamerules.js` first — this script never touches the wiki, it parses
 * the pinned captures in `resources/data/gamerules/raw/`.
 *
 * Run with: `node scripts/gamedata/generate-game-data.js`
 */
export default class GameDataGenerator {

    /** @type {string} */
    static DATA_DIR = 'resources/data';

    /** @type {string} */
    static GAMERULE_DIR = 'resources/data/gamerules';

    /** Path of the jar's deprecated-key map, which states the 26.1 game rule renames. */
    static DEPRECATED_LANG_PATH = 'assets/minecraft/lang/deprecated.json';

    /**
     * Builds the game rule defaults the derivation consumes, taking each field from whichever source is
     * authoritative for it.
     *
     * The jar owns the rename map, so that is where `legacyName` comes from — it is both more complete
     * than the wiki's prose list (85 rules against 26) and correct where the two disagree. The wiki owns
     * the default value and its type, which are compiled into bytecode and unreadable from the jar. The
     * three rules whose meaning was *inverted* in 26.1 are the one overlap: the jar lists them as removed
     * rather than renamed, so their old name and inversion flag are taken from the wiki.
     * @param {Object<string, string>} tables - Table wikitext keyed by category heading.
     * @param {string} history - The Java Edition history wikitext.
     * @param {{ renamed?: Object<string, string> }} deprecated - The jar's parsed `deprecated.json`.
     * @returns {{ id: string, legacyName: ?string, inverted: boolean, type: string, default: (boolean|number) }[]} The defaults, sorted by id.
     * @throws {Error} If a table row has a default that cannot be coerced to its declared type.
     */
    static buildGameRuleDefaults(tables, history, deprecated) {
        const legacyFromJar = GameDataDeriver.gameRuleLegacyNames(deprecated);

        /** @type {Map<string, { legacyName: string, inverted: boolean }>} */
        const invertedFromWiki = new Map();
        for(const [legacyName, { id, inverted }] of Object.entries(GameRuleParser.parseRenames(history))) {
            if(inverted) invertedFromWiki.set(id, { legacyName, inverted });
        }

        return GameRuleParser.parseTables(tables)
            .map(rule => ({
                id: rule.id,
                legacyName: legacyFromJar.get(rule.id) ?? invertedFromWiki.get(rule.id)?.legacyName ?? null,
                inverted: invertedFromWiki.get(rule.id)?.inverted ?? false,
                type: rule.type,
                default: rule.default,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * Cross-checks the generated data against the jar it came from.
     *
     * The point is to make drift loud rather than silent: a game rule the wiki has not documented yet
     * would otherwise be generated without a default and quietly reported as non-default forever.
     * @param {AdmZip} zip - The opened client jar.
     * @param {{ id: string, legacyName: ?string }[]} defaults - The game rule defaults.
     * @param {Object<string, string>} lang - The language map.
     * @param {{ removed?: string[], renamed?: Object<string, string> }} deprecated - The jar's parsed `deprecated.json`.
     * @returns {{ gameRulesMissingDefaults: string[], gameRulesNotInJar: string[], advancementsWithoutTranslation: string[] }} The review findings.
     */
    static review(zip, defaults, lang, deprecated) {
        const claimedKeys = new Set();
        const gameRulesNotInJar = [];
        for(const rule of defaults) {
            const key = GameDataDeriver.gameRuleLangKey(rule.id, rule.legacyName, lang);
            if(key) claimedKeys.add(key);
            else gameRulesNotInJar.push(rule.id);
        }

        // Every live rule name the jar knows should have been claimed by one of the harvested defaults.
        // Keys the game itself marks as removed are dead spellings kept for old worlds, not gaps — a
        // renamed rule is reached through its modern key, leaving the old one legitimately unclaimed.
        const removed = new Set(deprecated.removed ?? []);
        const gameRulesMissingDefaults = Object.keys(lang)
            .filter(key => key.startsWith('gamerule.') && !key.endsWith('.description') && !key.startsWith('gamerule.category.'))
            .filter(key => !claimedKeys.has(key) && !removed.has(key) && !deprecated.renamed?.[key]);

        const advancementsWithoutTranslation = [];
        for(const zipEntry of zip.getEntries()) {
            if(zipEntry.isDirectory) continue;

            const prefix = AssetsManager.ADVANCEMENT_PREFIXES.find(p => zipEntry.entryName.startsWith(p));
            if(!prefix) continue;

            const json = JSON.parse(zipEntry.getData().toString());
            const title = json.display?.title?.translate;
            if(title && lang[title] === undefined) advancementsWithoutTranslation.push(zipEntry.entryName);
        }

        return { gameRulesMissingDefaults, gameRulesNotInJar, advancementsWithoutTranslation };
    }

    /**
     * Regenerates every committed data file and the review report.
     * @returns {Promise<{ version: string, review: Object, counts: Object<string, number> }>} What was generated.
     * @throws {Error} If the captures are missing, the manifest is unavailable, or the jar cannot be downloaded.
     */
    static async generate() {
        const { tables, history } = await GameRuleHarvester.readCaptures();

        const version = await AssetsManager.latestRelease();
        if(!version) throw new Error('Could not resolve the latest release from the version manifest');

        const jarPath = path.join(os.tmpdir(), `mclinker-generate-${version}-${process.pid}.jar`);
        try {
            await AssetsManager.downloadJar(version, jarPath);
            const zip = new AdmZip(jarPath);

            const deprecatedEntry = zip.getEntry(this.DEPRECATED_LANG_PATH);
            if(!deprecatedEntry) throw new Error(`Client jar has no ${this.DEPRECATED_LANG_PATH}, which holds the game rule rename map`);
            const deprecated = JSON.parse(deprecatedEntry.getData().toString());

            const defaults = this.buildGameRuleDefaults(tables, history, deprecated);
            await fs.outputJson(path.join(this.GAMERULE_DIR, 'defaults.json'), defaults, { spaces: 2 });

            const data = AssetsManager.deriveGameData(zip, defaults);
            const lang = JSON.parse(zip.getEntry(AssetsManager.LANG_PATH).getData().toString());

            await fs.outputJson(path.join(this.DATA_DIR, 'advancements.json'), data.advancements, { spaces: 2 });
            await fs.outputJson(path.join(this.DATA_DIR, 'stats_custom.json'), { stats: data.customStats }, { spaces: 2 });
            await fs.outputJson(path.join(this.DATA_DIR, 'gamerules.json'), data.gameRules, { spaces: 2 });

            const review = this.review(zip, defaults, lang, deprecated);
            await fs.outputJson(path.join(this.GAMERULE_DIR, 'needs-review.json'), review, { spaces: 2 });

            return {
                version,
                review,
                counts: {
                    advancements: Object.values(data.advancements).reduce((sum, list) => sum + list.length, 0),
                    customStats: data.customStats.length,
                    gameRules: data.gameRules.length,
                },
            };
        }
        finally {
            await fs.remove(jarPath).catch(() => {});
        }
    }
}

// pathToFileURL rather than a string compare: on Windows the module url is `file:///C:/...`.
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { version, review, counts } = await GameDataGenerator.generate();
    console.log(`Generated from Minecraft ${version}: ${counts.advancements} advancements, ${counts.customStats} custom stats, ${counts.gameRules} game rules`);

    const findings = Object.entries(review).filter(([, list]) => list.length);
    if(findings.length) {
        console.error('\nNeeds review:');
        for(const [kind, list] of findings) console.error(`  ${kind}: ${list.join(', ')}`);
        process.exit(1);
    }
    console.log('Cross-check clean.');
}
