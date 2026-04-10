import { AutocompleteInteraction } from 'discord.js';
import { MaxAutoCompleteChoices, MaxCommandChoiceLength } from '../utilities/utils.js';
import logger from '../utilities/logger/logger.js';
import { trackError } from './analytics/AnalyticsCollector.js';
import Command from './Command.js';

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

    async autocompleteFromCommandCompletions(interaction, client) {
        const server = client.serverConnections.cache.get(interaction.guildId);
        if(!server) {
            return interaction.respond([])
                .catch(err => trackError('command', 'autocomplete', null, null, err, null, logger));
        }

        let focused = interaction.options.getFocused();
        focused = this.resolveAutocompleteValue(focused, interaction);
        if(focused == null) {
            return interaction.respond([])
                .catch(err => trackError('command', 'autocomplete', null, null, err, null, logger));
        }

        const userConnection = client.userConnections.cache.get(interaction.user.id);
        const response = await server.protocol.commandCompletions(focused, userConnection?.getUUID(server));

        if(response?.status !== 'success') {
            return interaction.respond([])
                .catch(err => trackError('command', 'autocomplete', null, null, err, null, logger));
        }

        const respondArray = this.normalizeCompletions(response.data, focused, interaction);
        if(respondArray.length > MaxAutoCompleteChoices) respondArray.length = MaxAutoCompleteChoices;

        return interaction.respond(respondArray)
            .catch(err => trackError('command', 'autocomplete', null, null, err, null, logger));
    }

    resolveAutocompleteValue(value, interaction) {
        if(typeof value !== 'string') return value;

        this.cleanupAutocompleteTokens();

        if(!value.startsWith(AutocompleteCommand.autocompletePreviewPrefix)) return value;

        const match = this.findAutocompleteSelectionValue(value, interaction);
        if(!match) return value;

        return `${match.fullValue}${match.suffix}`;
    }

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

    createFullCompletionValue(completion, focused, focusedWithoutLastWord) {
        const clampedStart = Math.max(0, Math.min(completion.start, focused.length));
        const clampedEnd = Math.max(clampedStart, Math.min(completion.end, focused.length));

        return `${focused.slice(0, clampedStart)}${completion.text}${focused.slice(clampedEnd)}`;
    }

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

    getAutocompletePreview(fullValue) {
        const maxLength = MaxCommandChoiceLength;
        if(fullValue.length <= maxLength) return fullValue;

        const tailLength = maxLength - AutocompleteCommand.autocompletePreviewPrefix.length;
        return `${AutocompleteCommand.autocompletePreviewPrefix}${fullValue.slice(-tailLength)}`;
    }

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

    getAutocompleteContextKey(interaction) {
        return `${interaction.user.id}:${interaction.commandName}`;
    }

    getAutocompleteContextMap(interaction) {
        const contextKey = this.getAutocompleteContextKey(interaction);
        return AutocompleteCommand.autocompleteSelectionCache.get(contextKey);
    }

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
