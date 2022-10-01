const { CommandInteraction, Message, PermissionFlagsBits, ApplicationCommandPermissionType, ApplicationCommandOptionType } = require('discord.js');
const { keys } = require('../api/messages');
const PluginProtocol = require('./PluginProtocol');

const ServerConnection = require('./ServerConnection');
const MCLinker = require('./MCLinker');
const { getSlashCommand } = require('../api/utils');

class Command {

    /**
     * @typedef {object} CommandOptions
     * @property {string} name - The name of this command.
     * @property {boolean} [defer=true] - Indicates whether to defer this command.
     * @property {boolean} [ephemeral=false] - Indicates whether to defer this command as ephemeral.
     * @property {array} [permissions=[]] - The permissions for this command.
     * @property {boolean} [requiresConnectedServer=true] - Indicates whether this command requires a connected server.
     * @property {int} [requiresConnectedUser=null] - The user argument index that requires a connected user.\
     * @property {boolean} [requiresConnectedPlugin=false] - Indicates whether this command requires a connected plugin.
     * @property {number} [arguments=0] - The amount of arguments this command requires.
     */

    /**
     * Creates a new Command instance.
     * @param {CommandOptions} options - The options for this command.
     */
    constructor(options = {}) {

        /**
         * The name of this command.
         * @type {string}
         */
        this.name = options.name;

        /**
         * The amount of arguments this command requires.
         * @type {number}
         */
        this.arguments = options.arguments ?? 0;

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
         * The permissions for this command.
         * @type {array}
         */
        this.permissions = options.permissions ?? [];

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
    }

    /**
     * Handles the execution of a command.
     * @param {(Message|CommandInteraction) & TranslatedResponses} interaction - The message/slash command interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {any[]} args - The command arguments set by the user.
     * @param {?ServerConnection} server - The connection of the server the command was executed in.
     * @returns {Promise<?boolean>|?boolean}
     */
    async execute(interaction, client, args, server) {
        if(this.defer) await interaction.deferReply?.({ ephemeral: this.ephemeral });

        if(this.requiresConnectedUser !== null) {
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
        }

        if(this.requiresConnectedPlugin && !(server?.protocol instanceof PluginProtocol)) {
            await interaction.replyTl(keys.api.command.errors.server_not_connected_plugin);
            return false;
        }
        else if(this.requiresConnectedServer && !server) {
            await interaction.replyTl(keys.api.command.errors.server_not_connected);
            return false;
        }

        else if(this.permissions.length > 0) {
            if(!await canRunCommand(this.name)) {
                const permission = this.permissions.find(permission => !interaction.member.permissions.has(permission));
                if(permission) {
                    await interaction.replyTl(
                        keys.api.command.warnings.no_permission,
                        { permission: permission.replace(/([A-Z])/g, ' $1').trim() },
                    );
                }
                else {
                    await interaction.replyTl(keys.api.command.warnings.no_permission);
                }
                return false;
            }
        }

        else if(args.length < this.arguments) {
            const subcommandGroup = args[0];
            const subcommand = args[1];

            let optionName;
            /** @type {ApplicationCommand} */
            const command = await getSlashCommand(interaction.guild.commands, this.name);
            //Find the command option in command.options
            const subcommandGroupOption = command.options.find(option => option.name === subcommandGroup);
            if(subcommandGroupOption?.type === ApplicationCommandOptionType.SubcommandGroup || subcommandGroupOption?.type === ApplicationCommandOptionType.Subcommand) {
                const subcommandOption = subcommandGroupOption.options.find(option => option.name === subcommand);
                if(subcommandOption?.type === ApplicationCommandOptionType.Subcommand) {
                    optionName = subcommandOption?.options[args.length - 2].name;
                }
                else optionName = subcommandGroupOption.options[args.length - 1].name;
            }
            else optionName = command.options[args.length].name;

            await interaction.replyTl(
                keys.api.command.warnings.no_argument,
                { argument: optionName },
            );

            return false;
        }

        return true;

        /**
         * Checks whether the user has permission to execute this slash command.
         * @param {string} name - The name of the command.
         * @returns {Promise<boolean>}
         */
        async function canRunCommand(name) {
            const memberPerms = interaction.member.permissionsIn(interaction.channel);
            if(memberPerms.has(PermissionFlagsBits.Administrator)) return true;

            let slashCommand = interaction.guild.commands.cache.find(cmd => cmd.name === name);
            if(!slashCommand) {
                const commands = await interaction.guild.commands.fetch();
                slashCommand = commands.find(cmd => cmd.name === name);
            }

            const perms =
                await interaction.guild.commands.permissions.fetch({ command: slashCommand.id }).catch(() => null)
                ?? await interaction.guild.commands.permissions.fetch({ command: client.user.id }).catch(() => null);
            if(!perms) return memberPerms.has(slashCommand.defaultMemberPermissions);

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

module.exports = Command;
