import { AutocompleteInteraction } from 'discord.js';
import { MaxAutoCompleteChoices, MaxCommandChoiceLength } from '../utilities/utils.js';
import rootLogger from '../utilities/logger/Logger.js';
import features from '../utilities/logger/features.js';
import { trackError } from './analytics/AnalyticsCollector.js';
import Command from './Command.js';

/** @abstract */
export default class AutocompleteCommand extends Command {

    static autocompletePreviewPrefix = '…';
    static autocompleteTokenTtlMs = 2 * 60 * 1000;

    /**
     * Stores autocomplete selections by context (`userId:commandName`) and preview key.
     * @type {Map<string, Map<string, { fullValue: string, expiresAt: number }>>}
     */
    static autocompleteSelectionCache = new Map();

    /**
     * Handles the autocompletion of a command.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @returns {void|Promise<void>}
     * @abstract
     */
    autocomplete(interaction, client) {
        throw new Error('Not implemented');
    }

    /**
     * Provides autocomplete suggestions by querying the Minecraft server for command completions.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @returns {Promise<void>}
     */
    async autocompleteFromCommandCompletions(interaction, client) {
        const server = client.serverConnections.cache.get(interaction.guildId);
        if(!server) {
            return interaction.respond([])
                .catch(err => trackError('command', 'autocomplete', interaction.guildId, interaction.user.id, err, null, rootLogger.child({
                    feature: features.commands[this.name],
                    guildId: interaction.guildId,
                }, { track: false })));
        }

        let focused = interaction.options.getFocused();
        focused = this.resolveAutocompleteValue(focused, interaction);
        if(focused == null) {
            return interaction.respond([])
                .catch(err => trackError('command', 'autocomplete', interaction.guildId, interaction.user.id, err, null, rootLogger.child({
                    feature: features.commands[this.name],
                    guildId: interaction.guildId,
                }, { track: false })));
        }

        const userConnection = client.userConnections.cache.get(interaction.user.id);
        const response = await server.protocol.commandCompletions(focused, userConnection?.getUUID(server));

        if(response?.status !== 'success') {
            return interaction.respond([])
                .catch(err => trackError('command', 'autocomplete', interaction.guildId, interaction.user.id, err, null, rootLogger.child({
                    feature: features.commands[this.name],
                    guildId: interaction.guildId,
                }, { track: false })));
        }

        const respondArray = this.normalizeCompletions(response.data, focused, interaction);
        if(respondArray.length > MaxAutoCompleteChoices) respondArray.length = MaxAutoCompleteChoices;

        return interaction.respond(respondArray)
            .catch(err => trackError('command', 'autocomplete', interaction.guildId, interaction.user.id, err, null, rootLogger.child({
                feature: features.commands[this.name],
                guildId: interaction.guildId,
            }, { track: false })));
    }

    /**
     * Resolves a potentially truncated autocomplete value back to its full form using the cache.
     * @param {string} value - The autocomplete input value.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction for context.
     * @returns {?string} The resolved full value, or the original value if no cache hit.
     */
    resolveAutocompleteValue(value, interaction) {
        if(typeof value !== 'string') return value;

        this.cleanupAutocompleteTokens();

        if(!value.startsWith(AutocompleteCommand.autocompletePreviewPrefix)) return value;

        const match = this.findAutocompleteSelectionValue(value, interaction);
        if(!match) return value;

        return `${match.fullValue}${match.suffix}`;
    }

    /**
     * Normalizes raw server completions into Discord autocomplete choices, caching overlong values.
     * @param {Array<{text: string, start: number, end: number}>} data - Raw completion data from the server.
     * @param {string} focused - The current focused input value.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction for caching context.
     * @returns {{name: string, value: string}[]} Normalized autocomplete choices.
     */
    normalizeCompletions(data, focused, interaction) {
        this.cleanupAutocompleteTokens();

        const rawCompletions = Array.isArray(data) ? data : [];
        const focusedWithoutLastWord = focused.replace(/[^\[\]\s{}=,]+$/gm, '');
        const normalizedChoices = [];

        for(const completion of rawCompletions) {
            const fullValue = this.createFullCompletionValue(completion, focused, focusedWithoutLastWord);
            if(!fullValue) continue;

            if(fullValue.length <= MaxCommandChoiceLength) {
                normalizedChoices.push({ name: fullValue, value: fullValue });
                continue;
            }

            const displayValue = this.getAutocompletePreview(fullValue);
            this.cacheAutocompleteSelection(displayValue, interaction, fullValue);

            normalizedChoices.push({ name: displayValue, value: displayValue });
        }

        return normalizedChoices;
    }

    /**
     * Constructs the full completion string by splicing the completion text into the focused input.
     * @param {{text: string, start: number, end: number}} completion - A single completion entry.
     * @param {string} focused - The current focused input value.
     * @param {string} focusedWithoutLastWord - The focused value with the trailing word removed.
     * @returns {string} The full completion value.
     */
    createFullCompletionValue(completion, focused, focusedWithoutLastWord) {
        const clampedStart = Math.max(0, Math.min(completion.start, focused.length));
        const clampedEnd = Math.max(clampedStart, Math.min(completion.end, focused.length));

        return `${focused.slice(0, clampedStart)}${completion.text}${focused.slice(clampedEnd)}`;
    }

    /**
     * Stores an overlong autocomplete value in the per-user cache, keyed by its truncated preview.
     * @param {string} key - The truncated preview key.
     * @param {AutocompleteInteraction} interaction - The interaction for user/command context.
     * @param {string} fullValue - The full, untruncated value to cache.
     */
    cacheAutocompleteSelection(key, interaction, fullValue) {
        let contextMap = this.getAutocompleteContextMap(interaction);
        if(!contextMap) {
            contextMap = new Map();
            AutocompleteCommand.autocompleteSelectionCache.set(this.getAutocompleteContextKey(interaction), contextMap);
        }
        const expiresAt = Date.now() + AutocompleteCommand.autocompleteTokenTtlMs;
        contextMap.set(key, {
            fullValue,
            expiresAt,
        });
    }

    /**
     * Creates a truncated preview string for an overlong autocomplete value.
     * @param {string} fullValue - The full value to preview.
     * @returns {string} A truncated string prefixed with the preview prefix, or the full value if short enough.
     */
    getAutocompletePreview(fullValue) {
        const maxLength = MaxCommandChoiceLength;
        if(fullValue.length <= maxLength) return fullValue;

        const tailLength = maxLength - AutocompleteCommand.autocompletePreviewPrefix.length;
        return `${AutocompleteCommand.autocompletePreviewPrefix}${fullValue.slice(-tailLength)}`;
    }

    /**
     * Looks up a cached full value from the autocomplete selection cache by matching the input.
     * @param {string} inputValue - The user's current input value (may be a truncated preview).
     * @param {AutocompleteInteraction} interaction - The interaction for user/command context.
     * @returns {?{key: string, fullValue: string, suffix: string}} The matched entry, or null.
     */
    findAutocompleteSelectionValue(inputValue, interaction) {
        const contextMap = this.getAutocompleteContextMap(interaction);
        if(!contextMap) return null;

        const directMatches = [];
        const partialMatches = [];
        for(const key of contextMap.keys()) {
            if(inputValue.startsWith(key)) {
                directMatches.push(key);
                continue;
            }

            if(key.startsWith(inputValue)) partialMatches.push(key);
        }

        directMatches.sort((a, b) => b.length - a.length);
        for(const key of directMatches) {
            const entry = contextMap.get(key);
            if(!entry || entry.expiresAt <= Date.now()) continue;

            return {
                key,
                fullValue: entry.fullValue,
                suffix: inputValue.slice(key.length),
            };
        }

        partialMatches.sort((a, b) => b.length - a.length);
        for(const key of partialMatches) {
            const entry = contextMap.get(key);
            if(!entry || entry.expiresAt <= Date.now()) continue;

            return {
                key,
                fullValue: entry.fullValue.slice(0, entry.fullValue.length - (key.length - inputValue.length)),
                suffix: '',
            };
        }

        return null;
    }

    /**
     * Returns the cache key for the current user + command context.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @returns {string} A context key in the format `userId:commandName`.
     */
    getAutocompleteContextKey(interaction) {
        return `${interaction.user.id}:${interaction.commandName}`;
    }

    /**
     * Gets the cached selections map for the current user + command context.
     * @param {AutocompleteInteraction} interaction - The autocomplete interaction.
     * @returns {?Map<string, {fullValue: string, expiresAt: number}>} The context map, or undefined if none.
     */
    getAutocompleteContextMap(interaction) {
        const contextKey = this.getAutocompleteContextKey(interaction);
        return AutocompleteCommand.autocompleteSelectionCache.get(contextKey);
    }

    /**
     * Removes expired entries from the autocomplete selection cache.
     */
    cleanupAutocompleteTokens() {
        const now = Date.now();

        for(const [contextKey, contextMap] of AutocompleteCommand.autocompleteSelectionCache.entries()) {
            for(const [key, entry] of contextMap.entries()) {
                if(entry.expiresAt <= now) {
                    contextMap.delete(key);
                }
            }

            if(contextMap.size === 0) AutocompleteCommand.autocompleteSelectionCache.delete(contextKey);
        }
    }
}
