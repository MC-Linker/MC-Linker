import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { MaxAutoCompleteChoices, MaxCommandChoiceLength } from '../utilities/utils.js';
import keys from '../utilities/keys.js';
import { ph } from '../utilities/messages.js';
import Command from './Command.js';

export default class AutocompleteCommand extends Command {

    static autocompleteTokenPrefix = '__mcl_ac:';
    static autocompleteTokenTtlMs = 2 * 60 * 1000;

    /**
     * Stores the mapping of autocomplete tokens to their corresponding full values and metadata.
     * @type {Map<string, { fullValue: string, expiresAt: number, guildId: string, userId: string, commandName: string }>}
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
        const resolvedFocus = this.resolveAutocompleteValue(focused, interaction);
        if(resolvedFocus !== null) focused = resolvedFocus;

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

    resolveAutocompleteValue(value, interaction) {
        if(typeof value !== 'string') return value;

        this.cleanupAutocompleteTokens();

        if(!value.startsWith(AutocompleteCommand.autocompleteTokenPrefix)) return value;

        const tokenData = AutocompleteCommand.autocompleteSelectionCache.get(value);
        if(!tokenData) return null;

        const isExpired = tokenData.expiresAt <= Date.now();
        const invalidContext = tokenData.guildId !== interaction.guildId ||
            tokenData.userId !== interaction.user.id ||
            tokenData.commandName !== interaction.commandName;

        if(isExpired || invalidContext) {
            AutocompleteCommand.autocompleteSelectionCache.delete(value);
            return null;
        }

        AutocompleteCommand.autocompleteSelectionCache.delete(value);
        return tokenData.fullValue;
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

            const token = this.createAutocompleteToken(interaction, fullValue);
            const displayValue = this.getAutocompletePreview(fullValue);

            normalizedChoices.push({ name: displayValue, value: token });
        }

        return normalizedChoices;
    }

    createAutocompleteToken(interaction, fullValue) {
        const token = `${AutocompleteCommand.autocompleteTokenPrefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
        const expiresAt = Date.now() + AutocompleteCommand.autocompleteTokenTtlMs;

        AutocompleteCommand.autocompleteSelectionCache.set(token, {
            fullValue,
            expiresAt,
            guildId: interaction.guildId,
            userId: interaction.user.id,
            commandName: interaction.commandName,
        });

        return token;
    }

    getAutocompletePreview(fullValue) {
        const maxLength = MaxCommandChoiceLength;
        if(fullValue.length <= maxLength) return fullValue;

        const tailLength = maxLength - 1;
        return `…${fullValue.slice(-tailLength)}`;
    }

    cleanupAutocompleteTokens() {
        const now = Date.now();

        for(const [token, value] of AutocompleteCommand.autocompleteSelectionCache.entries()) {
            if(value.expiresAt <= now) AutocompleteCommand.autocompleteSelectionCache.delete(token);
        }
    }

}
