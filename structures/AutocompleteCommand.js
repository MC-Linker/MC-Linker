import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { MaxAutoCompleteChoices, MaxCommandChoiceLength } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import { ph } from '../utilities/messages.js';
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
     * @inheritDoc
     * @param {(Message|CommandInteraction) & TranslatedResponses} interaction - The message/slash command interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {any[]} args - The command arguments set by the user.
     * @param {?ServerConnection} server - The connection of the server the command was executed in.
     * @returns {Promise<?boolean>|?boolean}
     * @abstract
     */
    execute(interaction, client, args, server) {
        return super.execute(interaction, client, args, server);
    }

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
                .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
        }

        let focused = interaction.options.getFocused();
        focused = this.resolveAutocompleteValue(focused, interaction, false);
        if(focused == null) {
            return interaction.respond([])
                .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
        }

        const userConnection = client.userConnections.cache.get(interaction.user.id);
        const response = await server.protocol.commandCompletions(focused, userConnection?.getUUID(server));

        if(response?.status !== 'success') {
            return interaction.respond([])
                .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
        }

        const respondArray = this.normalizeCompletions(response.data, focused, interaction);
        if(respondArray.length > MaxAutoCompleteChoices) respondArray.length = MaxAutoCompleteChoices;

        return interaction.respond(respondArray)
            .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.error(err)));
    }

    resolveAutocompleteValue(value, interaction, consume = true) {
        if(typeof value !== 'string') return value;

        this.cleanupAutocompleteTokens();

        if(!value.startsWith(AutocompleteCommand.autocompletePreviewPrefix)) return value;

        const match = this.findAutocompleteSelectionMatch(value, interaction);
        if(!match) return value;

        const resolvedValue = `${match.entry.fullValue}${match.suffix}`;
        if(consume) this.removeAutocompleteSelection(match.key, match.entry, interaction);

        return resolvedValue;
    }

    normalizeCompletions(data, focused, interaction) {
        this.cleanupAutocompleteTokens();

        const rawCompletions = Array.isArray(data) ? data : [];
        const focusedWithoutLastWord = focused.replace(/[^\[\]\s{}=,]+$/gm, '');
        const normalizedChoices = [];

        for(const completion of rawCompletions) {
            const completionString = typeof completion === 'string' ? completion : String(completion ?? '');
            const fullValue = !/[,\]}]/.test(completionString) ?
                `${focusedWithoutLastWord}${completionString}` :
                `${focused}${completionString}`;

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

    findAutocompleteSelectionMatch(inputValue, interaction) {
        const contextMap = this.getAutocompleteContextMap(interaction);
        if(!contextMap) return null;

        for(const key of contextMap.keys()) {
            if(inputValue.startsWith(key)) return {
                key,
                entry: contextMap.get(key),
                suffix: inputValue.slice(key.length),
            };
        }
        return null;
    }

    removeAutocompleteSelection(key, targetEntry, interaction) {
        const contextMap = this.getAutocompleteContextMap(interaction);
        if(!contextMap) return;

        const entry = contextMap.get(key);
        if(!entry || entry !== targetEntry) return;

        contextMap.delete(key);
        if(contextMap.size === 0) {
            AutocompleteCommand.autocompleteSelectionCache.delete(this.getAutocompleteContextKey(interaction));
        }
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
