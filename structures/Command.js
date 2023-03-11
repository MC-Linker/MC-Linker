import {
    ApplicationCommand,
    ApplicationCommandOptionType,
    ApplicationCommandPermissionType,
    CommandInteraction,
    Message,
    MessageMentions,
    PermissionFlagsBits,
} from 'discord.js';
import { fetchCommand, ph } from '../api/messages.js';
import keys from '../api/keys.js';

export default class Command {

    /**
     * @typedef {object} CommandOptions
     * @property {string} name - The name of this command.
     * @property {boolean} [defer=true] - Indicates whether to defer this command.
     * @property {boolean} [ephemeral=false] - Indicates whether to defer this command as ephemeral.
     * @property {boolean} [requiresConnectedServer=true] - Indicates whether this command requires a connected server.
     * @property {int} [requiresConnectedUser=null] - The user argument index that requires a connected user.
     * @property {boolean} [requiresConnectedPlugin=false] - Indicates whether this command requires a connected plugin.
     * @property {boolean} [ownerOnly=false] - Indicates whether this command is only available to the bot owner.
     * @property {string} [category] - The category of this command.
     */

    /**
     * Creates a new Command instance.
     * @param {CommandOptions} options - The options for this command.
     */
    constructor(options) {

        /**
         * The name of this command.
         * @type {string}
         */
        this.name = options.name;

        /**
         * Indicates whether to defer this command.
         * @type {boolean}
         */
        this.defer = options.defer ?? true;

        /**
         * Indicates whether to defer this command as ephemeral.
         * @type {boolean}
         */
        this.ephemeral = options.ephemeral ?? false;

        /**
         * Indicates whether this command requires a connected server.
         * @type {boolean}
         */
        this.requiresConnectedServer = options.requiresConnectedServer ?? true;

        /**
         * The user argument index that requires a connected user.
         * @type {?int}
         */
        this.requiresConnectedUser = options.requiresConnectedUser ?? null;

        /**
         * Indicates whether this command requires a connected plugin.
         * @type {boolean}
         */
        this.requiresConnectedPlugin = options.requiresConnectedPlugin ?? false;

        /**
         * Indicates whether this command is only available to the bot owner.
         * @type {boolean}
         */
        this.ownerOnly = options.ownerOnly ?? false;

        /**
         * The category of this command.
         * @type {?string}
         */
        this.category = options.category ?? null;
    }

    /**
     * Handles the execution of a command.
     * @param {(Message|CommandInteraction) & TranslatedResponses} interaction - The message/slash command interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {any[]} args - The command arguments set by the user.
     * @param {?ServerConnection} server - The connection of the server the command was executed in.
     * @returns {Promise<?boolean>|?boolean}
     * @abstract
     */
    async execute(interaction, client, args, server) {
        await interaction.replyTl(keys.api.command.executed, ph.std(interaction), { args: args.join(' ') });
        if(this.defer) await interaction.deferReply?.({ ephemeral: this.ephemeral });

        if(this.ownerOnly) {
            return interaction.user.id === process.env.OWNER_ID;
        }

        const settings = await client.serverSettingsConnections.cache.get(interaction.guildId);
        if(settings?.isDisabled('bot-commands', this.name)) {
            await interaction.replyTl(keys.api.command.warnings.disabled, await ph.interaction(interaction));
            return false;
        }

        if(this.requiresConnectedPlugin && !(server?.hasHttpProtocol() || server?.hasWebSocketProtocol())) {
            await interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);
            return false;
        }
        if(this.requiresConnectedServer && !server) {
            await interaction.replyTl(keys.api.command.errors.server_not_connected);
            return false;
        }

        const slashCommand = await fetchCommand(client.application.commands, this.name);
        const missingPermission = await canRunCommand(slashCommand);
        if(missingPermission !== true) {
            if(typeof missingPermission === 'string') {
                await interaction.replyTl(
                    keys.api.command.warnings.no_permission,
                    { permission: missingPermission },
                );
            }
            else {
                await interaction.replyTl(keys.api.command.warnings.no_unknown_permission);
            }
            return false;
        }

        if(this.requiresConnectedUser !== null && (this.requiresConnectedUser === 0 || args[this.requiresConnectedUser - 1] !== undefined)) {
            const user = await client.userConnections.userFromArgument(args[this.requiresConnectedUser], server);
            if(user.error === 'nullish') {
                await interaction.replyTl(keys.api.command.warnings.no_user);
                return false;
            }
            else if(user.error === 'cache') {
                await interaction.replyTl(keys.api.command.errors.user_not_connected);
                return false;
            }
            else if(user.error === 'fetch') {
                await interaction.replyTl(keys.api.utils.errors.could_not_fetch_uuid, { username: args[this.requiresConnectedUser] });
                return false;
            }

            args[this.requiresConnectedUser] = user;
        }

        const optionName = await getMissingOptionName(args, slashCommand);
        if(optionName) {
            await interaction.replyTl(
                keys.api.command.warnings.no_argument,
                { argument: optionName },
            );

            return false;
        }

        //Parse booleans and channels in arguments
        for(let item of args) {
            if(item === 'true') item = true;
            else if(item === 'false') item = false;
            else {
                const channelId = MessageMentions.ChannelsPattern.exec(item);
                item = channelId ? await client.channels.fetch(channelId[1]) : item;
            }
        }

        return true;

        async function getMissingOptionName(args, command) {
            const subcommandGroup = args[0];
            const subcommand = args[1];

            let option;
            const subcommandGroupOption = command.options.find(option => option.name === subcommandGroup);
            if(subcommandGroupOption?.type === ApplicationCommandOptionType.SubcommandGroup || subcommandGroupOption?.type === ApplicationCommandOptionType.Subcommand) {
                const subcommandOption = subcommandGroupOption.options.find(option => option.name === subcommand);
                if(subcommandOption?.type === ApplicationCommandOptionType.Subcommand) {
                    option = subcommandOption?.options?.[args.length - 2];
                }
                else option = subcommandGroupOption.options?.[args.length - 1];
            }
            else {
                const missingOption = command.options[args.length];
                if(missingOption?.type === ApplicationCommandOptionType.SubcommandGroup || missingOption?.type === ApplicationCommandOptionType.Subcommand) {
                    option = command.options;
                }
                else option = missingOption;
            }

            if(Array.isArray(option)) {
                return new Intl.ListFormat('en', { type: 'disjunction', style: 'short' })
                    .format(option.map(option => option.name));
            }
            else if(option?.required) return option.name;
        }

        /**
         * Checks whether the user has permission to execute this slash command.
         * @param {ApplicationCommand} command - The name of the command.
         * @returns {Promise<boolean|string>} - Whether the user has permission to execute this command. If not, the missing default permission.
         */
        async function canRunCommand(command) {
            const memberPerms = interaction.member.permissionsIn(interaction.channel);

            const memberPermissions = interaction.member.permissions?.toArray() ?? [];
            const requiredPermissions = command.defaultMemberPermissions?.toArray() ?? [];
            if(memberPerms.has(PermissionFlagsBits.Administrator)) return true;

            const perms =
                await interaction.guild.commands.permissions.fetch({ command: command.id }).catch(() => null)
                ?? await interaction.guild.commands.permissions.fetch({ command: client.user.id }).catch(() => null);
            if(!perms) return requiredPermissions.find(permission => !memberPermissions.includes(permission)) ?? true;

            let canRun = true;
            const everyone = perms
                .find(e => e.type === ApplicationCommandPermissionType.User && e.id === interaction.guild.id)?.permission;
            if(!everyone) canRun = false;

            const channelOverride = perms
                .find(e => e.type === ApplicationCommandPermissionType.Channel && e.id === interaction.channel.id)?.permission;
            if(channelOverride === false) return false;

            const everyChannel = perms
                .find(e => e.type === ApplicationCommandPermissionType.Channel && BigInt(e.id) === BigInt(interaction.guild.id) - 1n)?.permission;
            if(!channelOverride && everyChannel === false) return false;

            const roleOverrides = perms
                .filter(e => e.type === ApplicationCommandPermissionType.Role && e.id !== interaction.guildId && interaction.member.roles.cache.has(e.id));
            if((channelOverride || channelOverride === undefined) && roleOverrides.some(e => e.permission)) canRun = true;
            else if(roleOverrides.length && roleOverrides.every(e => !e.permission)) canRun = false;

            const userOverride = perms
                .find(e => e.type === ApplicationCommandPermissionType.User && e.id === interaction.member.id)?.permission;

            if(userOverride) return true;
            else if(userOverride === false) return false;

            return canRun;
        }
    }
}
