import Discord, { ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import keys, { getLanguageKey } from '../../utilities/keys.js';
import * as utils from '../../utilities/utils.js';
import { canSendMessages, MaxAutoCompleteChoices, MaxCommandChoiceLength } from '../../utilities/utils.js';
import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import Pagination from '../../structures/helpers/Pagination.js';
import { getChatWebhookCreationOptions } from '../../api/events/chat-handlers/ChatConstants.js';

const CHAT_COMMANDS_LABEL = 'chat commands';

export default class ChatChannel extends AutocompleteCommand {

    constructor() {
        super({
            name: 'chatchannel',
            category: 'settings',
            ephemeral: true,
        });
    }

    async autocomplete(interaction, client) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);
        if(subcommandGroup !== 'filter-commands') return;

        if(subcommand === 'add') {
            return this.autocompleteFromCommandCompletions(interaction, client);
        }
        else if(subcommand === 'remove') {
            const settings = await client.serverSettingsConnections.getOrConnect(interaction.guildId);
            const filteredCommands = settings.filteredCommands ?? [];
            const focused = interaction.options.getFocused().toLowerCase();

            const matchingDisabled = filteredCommands
                .filter(command => command.toLowerCase().includes(focused));

            const respondArray = [];
            for(const command of matchingDisabled) {
                if(command.length <= MaxCommandChoiceLength) {
                    respondArray.push({
                        name: command,
                        value: command,
                    });
                    continue;
                }

                const displayValue = this.getAutocompletePreview(command);
                this.cacheAutocompleteSelection(displayValue, interaction, command);
                respondArray.push({
                    name: displayValue,
                    value: displayValue,
                });
            }

            if(respondArray.length > MaxAutoCompleteChoices) respondArray.length = MaxAutoCompleteChoices;
            return interaction.respond(respondArray);
        }
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommandGroup = args[0];
        const subcommand = subcommandGroup === 'filter-commands' ? args[1] : args[0];

        if(subcommandGroup === 'filter-commands') {
            const selectedValue = args.slice(2).join(' ').trim();
            const resolvedValue = this.resolveAutocompleteValue(selectedValue, interaction);
            if(resolvedValue === null) {
                return interaction.editReplyTl(keys.commands.chatchannel.filter_commands.warnings.autocomplete_selection_expired);
            }

            const commandName = resolvedValue.toLowerCase();
            const settings = await client.serverSettingsConnections.getOrConnect(interaction.guildId);

            if(subcommand === 'add') {
                await settings.addFilteredCommand(commandName);
                return interaction.editReplyTl(keys.commands.chatchannel.filter_commands.success.disabled, {
                    type: CHAT_COMMANDS_LABEL,
                    disable: commandName,
                });
            }
            else if(subcommand === 'remove') {
                const hasExactFilter = settings.filteredCommands
                    .some(command => command.replace(/^\//, '').trim().toLowerCase() === commandName);
                if(!hasExactFilter) {
                    return interaction.editReplyTl(keys.commands.chatchannel.filter_commands.warnings.already_enabled, {
                        type: CHAT_COMMANDS_LABEL,
                        enable: commandName,
                    });
                }

                await settings.removeFilteredCommand(commandName);
                return interaction.editReplyTl(keys.commands.chatchannel.filter_commands.success.enabled, {
                    type: CHAT_COMMANDS_LABEL,
                    enable: commandName,
                });
            }
        }

        //Add chatchannel
        if(subcommand === 'add') {
            /** @type {Discord.BaseGuildTextChannel} */
            const channel = args[1];
            const allowDiscordToMinecraft = args[2] ?? true;

            if(!canSendMessages(interaction.guild.members.me, channel)) return interaction.editReplyTl(keys.api.utils.errors.not_sendable);

            const logChooserMsg = await interaction.editReplyTl(keys.commands.chatchannel.step.choose);
            let menu;
            try {
                menu = await logChooserMsg.awaitMessageComponent({
                    componentType: Discord.ComponentType.StringSelect,
                    time: 180_000,
                    filter: m => m.user.id === interaction.user.id && m.customId === 'log',
                });
            }
            catch(_) {
                return interaction.editReplyTl(keys.commands.chatchannel.warnings.not_collected);
            }

            //Create webhook for channel (all chat channels use webhooks for separate rate limit bucket)
            if(!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageWebhooks))
                return interaction.editReplyTl(keys.api.plugin.errors.no_webhook_permission);

            let webhook;
            try {
                const options = getChatWebhookCreationOptions();
                if(channel.isThread()) webhook = await channel.parent.createWebhook(options);
                else webhook = await channel.createWebhook(options);
            }
            catch(_) {
                return interaction.editReplyTl(keys.commands.chatchannel.errors.could_not_create_webhook);
            }

            const resp = await server.protocol.addChatChannel({
                id: channel.id,
                webhook: webhook.id,
                webhooks: [webhook.id],
                types: menu.values,
                allowDiscordToMinecraft,
            });
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return webhook.delete();

            await server.edit({ chatChannels: resp.data });

            return interaction.editReplyTl(keys.commands.chatchannel.success.add);
        }
        else if(subcommand === 'remove') {
            const channel = args[1];

            const chatChannel = server.chatChannels.find(c => c.id === channel.id);
            if(!chatChannel) return interaction.editReplyTl(keys.commands.chatchannel.warnings.channel_not_added);

            const resp = await server.protocol.removeChatChannel(chatChannel);
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

            await server.edit({ chatChannels: resp.data });
            return interaction.editReplyTl(keys.commands.chatchannel.success.remove);
        }
        else if(subcommand === 'list') {
            if(!server.chatChannels?.length) return interaction.editReplyTl(keys.commands.chatchannel.warnings.no_channels);

            /** @type {PaginationPages} */
            const pages = {};

            for(let i = 0; i < server.chatChannels.length; i++) {
                const channel = server.chatChannels[i];
                const options = getLanguageKey(keys.commands.chatchannel.step.choose.components[0].options);
                const formattedTypes = channel.types.map(type => options.find(o => o.value === type).label).join(',\n');

                const channelEmbed = getEmbed(
                    keys.commands.chatchannel.success.list,
                    ph.std(interaction),
                    {
                        channel: await interaction.guild.channels.fetch(channel.id),
                        discord_to_minecraft: channel.allowDiscordToMinecraft ? keys.commands.serverinfo.enabled : keys.commands.serverinfo.disabled,
                        channel_types: formattedTypes,
                    },
                );

                const channelButton = getComponent(keys.commands.chatchannel.success.channel_button, {
                    index1: i + 1,
                    index: i,
                });

                pages[channelButton.data.custom_id] = {
                    options: { embeds: [channelEmbed] },
                    button: channelButton,
                };
            }

            const pagination = new Pagination(client, interaction, pages, {
                highlightSelectedButton: ButtonStyle.Primary,
            });
            return pagination.start();
        }
    }
}
