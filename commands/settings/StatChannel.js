import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import * as utils from '../../utilities/utils.js';
import { ButtonStyle, ChannelType, GuildChannel, RateLimitError } from 'discord.js';
import UpdateStatsChannel from '../../api/events/UpdateStatsChannel.js';

export default class StatChannel extends Command {

    constructor() {
        super({
            name: 'statchannel',
            category: 'settings',
            ephemeral: true,
        });
    }


    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[string, import('discord.js').GuildChannel, string, string, string]} args - [0] The subcommand (add/remove/list), [1] The channel, [2] The online template, [3] The offline template or undefined, [4] The update target or undefined.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const subcommand = args[0];
        if(subcommand === 'add') {
            /** @type {GuildChannel} */
            const channel = args[1];
            const online = args[2];
            const offline = args[3] ?? online;
            const updateTarget = args[4] ?? 'name';

            if(!channel.manageable) return interaction.editReplyTl(keys.commands.statchannel.errors.not_manageable);
            if(updateTarget === 'topic' && ![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type))
                return interaction.editReplyTl(keys.commands.statchannel.errors.no_topic_supported);

            /** @type {StatsChannelData} */
            const statChannelData = {
                id: channel.id,
                updateTarget,
                names: { online, offline },
            };

            try {
                // Try initial channel update
                const message = await UpdateStatsChannel.fetchCurrentName(statChannelData, server);
                if(message) await UpdateStatsChannel.applyUpdate(channel, statChannelData, message);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    // Channel rename is rate limited — schedule a deferred re-sync
                    UpdateStatsChannel.scheduleRetry(channel.id, err.retryAfter, statChannelData, server.id, client);
                }
                else return interaction.editReplyTl(keys.commands.statchannel.errors.initial_update_failed);
            }

            const resp = await server.protocol.addStatsChannel(statChannelData);
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

            // Bot is source of truth — replace existing entry with same id
            await server.edit({ statChannels: [...server.statChannels.filter(c => c.id !== channel.id), statChannelData] });

            await interaction.editReplyTl(keys.commands.statchannel.success.add);
        }
        else if(subcommand === 'remove') {
            const channel = args[1];

            const statChannel = server.statChannels.find(c => c.id === channel.id);
            if(!statChannel) return interaction.editReplyTl(keys.common.channels.channel_not_added);

            const response = await server.protocol.removeStatsChannel(statChannel);
            if(!await utils.handleProtocolResponse(response, server.protocol, interaction)) return;

            await server.edit({ statChannels: server.statChannels.filter(c => c.id !== channel.id) });

            await interaction.editReplyTl(keys.commands.statchannel.success.remove);
        }
        else if(subcommand === 'list') {
            const statChannels = server.statChannels;
            if(!statChannels.length) return await interaction.editReplyTl(keys.common.channels.no_channels);

            /** @type {PaginationPages} */
            const pages = {};

            for(const channel of statChannels) {
                const channelEmbed = getEmbed(
                    keys.commands.statchannel.success.list,
                    ph.std(interaction),
                    {
                        channel: await interaction.guild.channels.fetch(channel.id),
                        online_name: channel.names.online,
                        offline_name: channel.names.offline ?? channel.names.online,
                        update_target: channel.updateTarget === 'topic' ? 'Topic' : 'Name',
                    },
                );

                const index = statChannels.indexOf(channel);
                const channelButton = getComponent(keys.common.channels.channel_button, {
                    index1: index + 1,
                    index: index,
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
