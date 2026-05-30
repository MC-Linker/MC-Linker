import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import keys from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { UUIDRegex } from '../../utilities/utils.js';
import Discord, { ButtonStyle, ComponentType } from 'discord.js';
import crypto from 'crypto';
import {
    addPh,
    addTranslatedResponses,
    createActionRows,
    getComponent,
    getReplyOptions,
    ph,
} from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import DefaultButton from '../../structures/helpers/DefaultButton.js';

export default class Account extends AutocompleteCommand {

    constructor() {
        super({
            name: 'account',
            category: 'settings',
            requiresConnectedServer: false,
            allowUser: true,
            ephemeral: true,
        });
    }

    /**
     * @inheritdoc
     */
    autocomplete(interaction, client) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);
        const focused = interaction.options.getFocused(true);

        if(subcommandGroup === 'dms' && subcommand === 'unblock' && focused.name === 'player') {
            const settings = client.userSettingsConnections.cache.get(interaction.user.id);
            const blockedPlayers = settings?.dms.blockedPlayers ?? [];
            const focusedValue = focused.value.toLowerCase();

            const choices = blockedPlayers
                .filter(p => p.startsWith(focusedValue))
                .map(p => ({ name: p, value: p }));

            return interaction.respond(choices).catch(() => {});
        }

        return interaction.respond([]).catch(() => {});
    }

    /**
     * @inheritdoc
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} interaction
     * @param {MCLinker} client
     * @param {[string, ...unknown[]]} args - Slash command arguments, leading with the subcommand (or subcommand-group)
     *   name. Concretely:
     *   - `['connect', usernameOrUUID: string, setAsGlobal?: boolean]`
     *   - `['disconnect']`
     *   - `['manage']`
     *   - `['dms', 'block'|'unblock', serverArg?: boolean, playerArg?: string]`
     * @param {?ServerConnection} server
     * @param {import('../../utilities/logger/Logger.js').default} logger
     */
    async run(interaction, client, args, server, logger) {
        const subcommandGroup = args[0];

        if(subcommandGroup === 'connect') return this._handleConnect(interaction, client, args, server, logger);
        if(subcommandGroup === 'disconnect') return this._handleDisconnect(interaction, client, server, logger);
        if(subcommandGroup === 'manage') return this._handleManage(interaction, client, server, logger);
        if(subcommandGroup === 'dms') return this._handleDms(interaction, client, args, server, args[1]);
    }

    /**
     * Resolves a username/uuid argument to a partial UserConnection (uuid + username + premium) using server context.
     * Returns null if resolution fails (e.g. cracked name on an online-mode server).
     * @param {string} usernameOrUUID
     * @param {?ServerConnection} server
     * @returns {Promise<?Pick<UserConnectionData, 'uuid' | 'username' | 'premium'>>}
     */
    async _resolveAccount(usernameOrUUID, server) {
        if(usernameOrUUID.match(UUIDRegex)) {
            const uuid = utils.addHyphen(usernameOrUUID);
            const username = await utils.fetchUsername(uuid);
            if(!username) return null;
            // UUID-input → only on Mojang-known accounts; treat as premium
            return { uuid, username, premium: true };
        }

        // Floodgate: prefix-bearing username on a server with floodgate enabled
        if(server?.floodgatePrefix && usernameOrUUID.startsWith(server.floodgatePrefix)) {
            const bedrockName = usernameOrUUID.slice(server.floodgatePrefix.length);
            const uuid = await utils.fetchFloodgateUUID(bedrockName);
            if(!uuid) return null;
            return { uuid, username: usernameOrUUID, premium: true };
        }

        // Try Mojang lookup first
        const mojangUUID = await utils.fetchUUID(usernameOrUUID);
        if(mojangUUID) return { uuid: mojangUUID, username: usernameOrUUID, premium: true };

        // Cracked: only allowed on offline-mode servers
        if(server && !server.online)
            return { uuid: utils.createUUIDv3(usernameOrUUID), username: usernameOrUUID, premium: false };

        return null;
    }

    /**
     * Decides the scope ('global' or serverId) for a new link based on premium-ness, current state,
     * and the user's set-as-global preference. Assumes `server` is non-null (caller guarantees this).
     * @param {MCLinker} client
     * @param {string} discordId
     * @param {ServerConnection} server
     * @param {boolean} premium
     * @param {?boolean} setAsGlobal - The user's explicit choice: true = make this global, false = force
     *   per-server, null/undefined = auto (prefer global if none yet).
     * @returns {'global'|string} - 'global' or the server's id.
     */
    _decideScope(client, discordId, server, premium, setAsGlobal) {
        // Cracked links can't be global — uniqueness can't be guaranteed across servers.
        if(!premium) return server.id;
        // Explicit opt-out → force per-server even for premium accounts.
        if(setAsGlobal === false) return server.id;

        const hasGlobal = !!client.userConnections.getGlobal(discordId);
        // Explicit opt-in → only honourable if no global yet, otherwise fall through to per-server.
        if(setAsGlobal === true) return hasGlobal ? server.id : 'global';
        // Auto: prefer global when none exists, otherwise per-server.
        return hasGlobal ? server.id : 'global';
    }

    /**
     * Handler for `/account connect <user> [set-as-global]`.
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} interaction
     * @param {MCLinker} client
     * @param {['connect', string, boolean?]} args - `[0]` literal `'connect'`, `[1]` username or UUID,
     *   `[2]` optional `set-as-global` boolean.
     * @param {?ServerConnection} server
     * @param {import('../../utilities/logger/Logger.js').default} logger
     * @returns {Promise<void>}
     */
    async _handleConnect(interaction, client, args, server, logger) {
        if(!interaction.inGuild()) return interaction.editReplyTl(keys.main.no_access.not_in_guild);
        if(!server) return interaction.editReplyTl(keys.api.command.errors.server_not_connected);

        const usernameOrUUID = args[1];
        const setAsGlobal = args[2];
        if(usernameOrUUID.match(Discord.MessageMentions.UsersPattern)) return interaction.editReplyTl(keys.commands.account.warnings.mention);

        const resolved = await this._resolveAccount(usernameOrUUID, server);
        if(!resolved) {
            const key = server.online
                ? keys.commands.account.errors.could_not_resolve_account_online
                : keys.commands.account.errors.could_not_resolve_account_offline;

            return await interaction.editReplyTl(key, { user: usernameOrUUID });
        }

        const { uuid, username, premium } = resolved;

        const scope = this._decideScope(client, interaction.user.id, server, premium, setAsGlobal);

        const existing = client.userConnections.getRaw(interaction.user.id, scope);
        if(existing) {
            const key = scope === 'global'
                ? keys.commands.account.warnings.global_already_linked
                : keys.commands.account.warnings.server_already_linked;
            return interaction.editReplyTl(key, { existing_username: existing.username, ip: server.displayIp });
        }

        const code = crypto.randomBytes(16).toString('hex').slice(0, 5);

        const verifyResponse = await server.protocol.verifyUser(code, uuid);
        if(!await utils.handleProtocolResponse(verifyResponse, server.protocol, interaction)) return;

        await interaction.editReplyTl(keys.commands.account.step.verification_info, { code, ip: server.displayIp });

        const verificationResponse = await client.broadcastEval(async (c, { uuid, code, serverId }) => {
            const server = c.serverConnections.cache.get(serverId);
            const socket = server?.protocol.socket;
            if(!socket) return { status: 'timeout' };

            try {
                const data = await c.api.waitForWSEvent(socket, 'verify-response', 180_000, rawData => {
                    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                    if(parsed.uuid !== uuid || parsed.code !== code) return;
                    return parsed;
                });
                return { status: 'success', data };
            }
            catch(err) {
                if(err instanceof c.api.constructor.EventTimeoutError) return { status: 'timeout' };
                return { status: 'error', error: err.message };
            }
        }, {
            context: { uuid, code, serverId: server.id },
            shard: 0,
        });

        if(verificationResponse.status === 'timeout') return interaction.editReplyTl(keys.commands.account.warnings.verification_timeout);
        else if(verificationResponse.status !== 'success') return interaction.editReplyTl(keys.main.errors.could_not_execute_command);

        await client.userConnections.connect({
            discordId: interaction.user.id,
            scope,
            uuid,
            username,
            premium,
        });

        const settings = client.userSettingsConnections.cache.get(interaction.user.id);
        if(settings) await settings.syncLinkedRoles();

        await client.serverConnections.syncRolesAcrossAllServers(interaction.user.id);
        await interaction.editReplyTl(keys.commands.account.success.verified);
    }

    /**
     * Handler for `/account disconnect`. Takes no slash options — disconnects the per-server link for the current
     * server if present, else the global link.
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} interaction
     * @param {MCLinker} client
     * @param {?ServerConnection} server
     * @param {import('../../utilities/logger/Logger.js').default} logger
     * @returns {Promise<void>}
     */
    async _handleDisconnect(interaction, client, server, logger) {
        // Resolve the link to disconnect: per-server (in current server) takes priority, else global.
        const link = client.userConnections.resolveForServer(interaction.user.id, server);

        if(!link) return void await interaction.editReplyTl(keys.commands.account.warnings.not_connected);

        await this._disconnectLink(client, interaction.user.id, link);
        await interaction.editReplyTl(keys.commands.account.success.disconnect);
    }

    /**
     * Removes a link, re-syncs LinkedRoles, and kicks from required-role servers that no longer have a fallback link.
     * @param {MCLinker} client
     * @param {string} discordId
     * @param {UserConnection} link
     * @returns {Promise<void>}
     */
    async _disconnectLink(client, discordId, link) {
        const isGlobal = link.scope === 'global';
        const username = link.username;

        await client.userConnections.disconnect(link);

        const settings = client.userSettingsConnections.cache.get(discordId);
        if(settings) await settings.syncLinkedRoles();

        const kickMessage = keys.commands.account.kick_messages.disconnected;
        if(isGlobal) await client.serverConnections.kickFromOrphanedRequiredRoleServers(discordId, username, kickMessage);
        else {
            const targetServer = client.serverConnections.cache.get(link.scope);
            if(targetServer) await client.serverConnections.kickFromServerIfOrphaned(discordId, username, targetServer, kickMessage);
        }
    }

    /**
     * Builds the badge + scope labels for a link's row in `/account manage`.
     * @param {UserConnection} link
     * @param {MCLinker} client
     * @returns {{ badge: string, scopeLabel: string }} - Translated strings.
     */
    _formatLinkLabel(link, client) {
        const manageKeys = keys.commands.account.success.manage;

        let badge;
        if(!link.premium) badge = manageKeys.badge_cracked;
        else if(utils.isFloodgateUUID(link.uuid)) badge = manageKeys.badge_bedrock;
        else badge = manageKeys.badge_premium;

        let scopeLabel;
        if(link.scope === 'global') scopeLabel = manageKeys.scope_global;
        else {
            const targetServer = client.serverConnections.cache.get(link.scope);
            scopeLabel = addPh(manageKeys.scope_server, { ip: targetServer?.displayIp ?? link.scope });
        }
        return { badge, scopeLabel };
    }

    /**
     * Handler for `/account manage`. Takes no slash options — renders a paginated view of the user's links with
     * row-level Disconnect / Promote to global / Use on this server buttons.
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} interaction
     * @param {MCLinker} client
     * @param {?ServerConnection} server
     * @param {import('../../utilities/logger/Logger.js').default} logger
     * @returns {Promise<void>}
     */
    async _handleManage(interaction, client, server, logger) {
        const links = client.userConnections.getAll(interaction.user.id);
        if(links.length === 0) return void await interaction.editReplyTl(keys.commands.account.warnings.not_connected);

        // Sort: global first, then per-server alphabetically
        links.sort((a, b) => {
            if(a.scope === 'global') return -1;
            if(b.scope === 'global') return 1;
            return a.scope.localeCompare(b.scope);
        });

        const hasGlobal = !!client.userConnections.getGlobal(interaction.user.id);

        /** @type {import('../../structures/helpers/Pagination.js').PaginationPages} */
        const pages = {};
        // Track which action buttons appear, for collector registration after pagination starts
        const actionButtonIds = new Set();
        const manageButtons = keys.commands.account.success.manage.buttons;

        for(let i = 0; i < links.length; i++) {
            const link = links[i];
            const { badge, scopeLabel } = this._formatLinkLabel(link, client);

            const actionButtons = [];

            // Disconnect (always).
            const disconnectBtn = getComponent(manageButtons.disconnect, { scope: link.scope });
            actionButtonIds.add(disconnectBtn.data.custom_id);
            actionButtons.push(disconnectBtn);

            // Promote to global (premium per-server link, user has no global).
            if(link.premium && link.scope !== 'global' && !hasGlobal) {
                const promoteBtn = getComponent(manageButtons.promote, { scope: link.scope });
                actionButtonIds.add(promoteBtn.data.custom_id);
                actionButtons.push(promoteBtn);
            }

            // Copy a per-server link onto this server. Premium works anywhere; cracked only on offline servers.
            if(server && link.scope !== 'global' && link.scope !== server.id && (link.premium || !server.online)) {
                const useHereBtn = getComponent(manageButtons.use_here, { scope: link.scope });
                actionButtonIds.add(useHereBtn.data.custom_id);
                actionButtons.push(useHereBtn);
            }

            const avatarUrl = await utils.getCachedAvatarURL(link.username);
            const pageOptions = getReplyOptions(keys.commands.account.success.manage.row, ph.std(interaction), {
                username: link.username,
                avatar_url: avatarUrl,
                badge,
                scope: scopeLabel,
                uuid: link.uuid,
            });
            pageOptions.components = createActionRows(actionButtons);

            const pageButton = getComponent(keys.commands.account.success.manage.row_button, {
                index: i,
                label: link.username,
            });
            pages[pageButton.data.custom_id] = {
                button: pageButton,
                options: pageOptions,
                startPage: i === 0,
            };
        }

        const pagination = new Pagination(client, interaction, pages, {
            highlightSelectedButton: ButtonStyle.Primary,
        });
        await pagination.start();

        // Wire action buttons against the pagination's collector
        for(const buttonId of actionButtonIds) {
            new DefaultButton({
                id: buttonId,
                author: interaction.user,
                ephemeral: true,
                defer: false,
                collector: pagination.collector,
            }, this._handleManageAction.bind(this, interaction, server));
        }
    }

    /**
     * Dispatches `/account manage` row-button actions. Bound with the originating `interaction` and `server`.
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} originalInteraction
     * @param {?ServerConnection} currentServer
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} btnInteraction
     * @param {MCLinker} client
     * @returns {Promise<void>}
     */
    async _handleManageAction(originalInteraction, currentServer, btnInteraction, client) {
        btnInteraction = addTranslatedResponses(btnInteraction);
        const customId = btnInteraction.customId;
        const sepIndex = customId.indexOf(':');
        const action = customId.slice('account_manage_'.length, sepIndex);
        const scope = customId.slice(sepIndex + 1);
        const discordId = btnInteraction.user.id;

        const link = client.userConnections.getRaw(discordId, scope);
        if(!link) return void await btnInteraction.replyTl(keys.commands.account.warnings.link_gone);

        if(action === 'disconnect') return this._handleManageDisconnect(btnInteraction, client, link);
        if(action === 'promote') return this._handleManagePromote(btnInteraction, client, link);
        if(action === 'use_here') return this._handleManageUseHere(btnInteraction, client, link, currentServer);
    }

    /**
     * Disconnect button handler in `/account manage`. Shows a Confirm/Cancel ephemeral prompt, then removes the link.
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} btnInteraction
     * @param {MCLinker} client
     * @param {UserConnection} link
     * @returns {Promise<void>}
     */
    async _handleManageDisconnect(btnInteraction, client, link) {
        // Discord modal with a Yes/No radio group. User cancels by dismissing the modal (timeout) or picking "No".
        const token = `${link.scope}:${Date.now()}`;
        const modalCustomId = `account_manage_disconnect_confirm:${token}`;
        await btnInteraction.showModalTl(keys.commands.account.warnings.disconnect_confirm_modal, {
            token,
            username: link.username,
        });

        let submitted;
        try {
            submitted = await btnInteraction.awaitModalSubmit({
                filter: i => i.user.id === btnInteraction.user.id && i.customId === modalCustomId,
                time: 60_000,
            });
        }
        catch {
            // User dismissed the modal or it timed out — silent cancel.
            return;
        }
        submitted = addTranslatedResponses(submitted);

        if(submitted.fields.getRadioGroup('confirm') !== 'yes') return void await submitted.replyTl(keys.commands.account.warnings.disconnect_cancelled);

        await submitted.replyTl(keys.commands.account.step.disconnecting, { username: link.username });
        await this._disconnectLink(client, btnInteraction.user.id, link);
        await submitted.editReplyTl(keys.commands.account.success.disconnect);
    }

    /**
     * Promote-to-global button handler. Moves a premium per-server link to global scope if no global exists yet.
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} btnInteraction
     * @param {MCLinker} client
     * @param {UserConnection} link
     * @returns {Promise<void>}
     */
    async _handleManagePromote(btnInteraction, client, link) {
        if(!link.premium || link.scope === 'global') return void await btnInteraction.replyTl(keys.commands.account.warnings.promote_not_eligible);
        if(client.userConnections.getGlobal(link.discordId)) return void await btnInteraction.replyTl(keys.commands.account.warnings.promote_global_exists);

        // Atomically: disconnect the per-server entry, then connect a global one with the same fields.
        await client.userConnections.disconnect(link);
        await client.userConnections.connect({
            discordId: link.discordId,
            scope: 'global',
            uuid: link.uuid,
            username: link.username,
            premium: true,
        });

        // The promotion likely changes the canonical platform_username (global preferred over per-server).
        const settings = client.userSettingsConnections.cache.get(link.discordId);
        if(settings) await settings.syncLinkedRoles();

        await btnInteraction.replyTl(keys.commands.account.success.promote, { username: link.username });
    }

    /**
     * Use-on-this-server button handler. Copies the source link's UUID into a per-server link for `currentServer`.
     * Prompts for overwrite confirmation if a per-server link already exists for the target server.
     * @param {import('discord.js').ButtonInteraction & TranslatedResponses} btnInteraction
     * @param {MCLinker} client
     * @param {UserConnection} link - The source link being reused.
     * @param {?ServerConnection} currentServer
     * @returns {Promise<void>}
     */
    async _handleManageUseHere(btnInteraction, client, link, currentServer) {
        if(!currentServer) return void await btnInteraction.replyTl(keys.commands.account.warnings.use_here_no_server);
        if(link.scope === currentServer.id) return void await btnInteraction.replyTl(keys.commands.account.warnings.use_here_same_server);

        const existing = client.userConnections.getRaw(link.discordId, currentServer.id);
        if(existing) {
            // Single Confirm button — user cancels by ignoring (timeout).
            const token = `${currentServer.id}:${Date.now()}`;
            const confirmBtn = getComponent(keys.commands.account.success.manage.buttons.use_here_overwrite, { token });
            const overwriteId = confirmBtn.data.custom_id;

            const opts = getReplyOptions(keys.commands.account.warnings.use_here_overwrite, {
                old_username: existing.username,
                new_username: link.username,
            });
            opts.components = createActionRows([confirmBtn]);
            /** @type {import('discord.js').InteractionResponse} */
            const promptMsg = await btnInteraction.reply(opts);

            try {
                let press = await promptMsg.awaitMessageComponent({
                    filter: i => i.user.id === btnInteraction.user.id && i.customId === overwriteId,
                    componentType: ComponentType.Button,
                    time: 60_000,
                });
                press = addTranslatedResponses(press);
                await press.updateTl(keys.commands.account.step.use_here_connecting);
                await this._disconnectLink(client, link.discordId, existing);
            }
            catch {
                await btnInteraction.editReplyTl(keys.commands.account.warnings.disconnect_timeout);
                return;
            }
        }

        await client.userConnections.connect({
            discordId: link.discordId,
            scope: currentServer.id,
            uuid: link.uuid,
            username: link.username,
            premium: link.premium,
        });

        const settings = client.userSettingsConnections.cache.get(link.discordId);
        if(settings) await settings.syncLinkedRoles();

        // TODO new automatically deciding tl function
        if(existing) await btnInteraction.editReplyTl(keys.commands.account.success.use_here, {
            username: link.username,
            ip: currentServer.displayIp,
        });
        else await btnInteraction.replyTl(keys.commands.account.success.use_here, {
            username: link.username,
            ip: currentServer.displayIp,
        });
    }

    /**
     * Handler for `/account dms block|unblock [server] [player]`.
     * @param {import('discord.js').ChatInputCommandInteraction & TranslatedResponses} interaction
     * @param {MCLinker} client
     * @param {['dms', 'block'|'unblock', boolean?, string?]} args - `[0]` literal `'dms'`, `[1]` `'block'|'unblock'`,
     *   `[2]` optional `server` boolean, `[3]` optional `player` string.
     * @param {?ServerConnection} server
     * @param {'block'|'unblock'} subcommand - The leaf subcommand name, already extracted by `run()`.
     * @returns {Promise<void>}
     */
    async _handleDms(interaction, client, args, server, subcommand) {
        const isBlock = subcommand === 'block';
        const serverArg = args[2];
        const playerArg = args[3];

        if(serverArg && !server) return void await interaction.editReplyTl(keys.commands.account.warnings.dms_no_server);

        const userSettings = await client.userSettingsConnections.getOrConnect(interaction.user.id);
        const { dms } = userSettings;

        // Global toggle
        if(!playerArg && !serverArg) {
            if(isBlock && !dms.enabled) return void await interaction.editReplyTl(keys.commands.account.warnings.dms_already_blocked_global);
            if(!isBlock && dms.enabled) return void await interaction.editReplyTl(keys.commands.account.warnings.dms_not_blocked_global);

            dms.enabled = !isBlock;
            await userSettings.edit({ dms });
            return void await interaction.editReplyTl(isBlock ? keys.commands.account.success.dms_block_global : keys.commands.account.success.dms_unblock_global);
        }

        const applied = [];

        if(playerArg) {
            const player = playerArg.toLowerCase();
            if(isBlock && !dms.blockedPlayers.includes(player)) {
                dms.blockedPlayers.push(player);
                applied.push(playerArg);
            }
            else if(!isBlock && dms.blockedPlayers.includes(player)) {
                dms.blockedPlayers = dms.blockedPlayers.filter(p => p !== player);
                applied.push(playerArg);
            }
        }

        if(serverArg) {
            if(isBlock && !dms.blockedServers.includes(server.id)) {
                dms.blockedServers.push(server.id);
                applied.push(server.displayIp);
            }
            else if(!isBlock && dms.blockedServers.includes(server.id)) {
                dms.blockedServers = dms.blockedServers.filter(id => id !== server.id);
                applied.push(server.displayIp);
            }
        }

        if(!applied.length) {
            const target = playerArg ?? server.displayIp;
            return void await interaction.editReplyTl(isBlock ? keys.commands.account.warnings.dms_already_blocked_specific : keys.commands.account.warnings.dms_not_blocked_specific, { target });
        }

        await userSettings.edit({ dms });
        await interaction.editReplyTl(
            isBlock ? keys.commands.account.success.dms_block_specific : keys.commands.account.success.dms_unblock_specific,
            { target: applied.join(', ') },
        );
    }
}
