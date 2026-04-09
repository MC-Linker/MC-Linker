import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import * as utils from '../../utilities/utils.js';
import { ButtonStyle, GuildChannel, RateLimitError } from 'discord.js';
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
     * @param {[string, string|import('discord.js').GuildChannel, import('discord.js').GuildChannel|string, string, string]} args - [0] The subcommand (add/remove/list), [1] The stat type or channel, [2] The channel or name template, [3] The name template or offline name, [4] The offline name.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const subcommand = args[0];
        if(subcommand === 'add') {
            const type = args[1];
            /** @type {GuildChannel} */
            const channel = args[2];
            if(!channel.manageable) {
                return interaction.editReplyTl(keys.commands.statchannel.errors.not_manageable);
            }

            /** @type {StatsChannelData} */
            const statChannel = {
                type,
                id: channel.id,
                names: {},
            };
            if(type === 'member-counter') statChannel.names.members = args[3];
            else if(type === 'status') {
                statChannel.names.online = args[3];
                statChannel.names.offline = args[4];
            }

            const resp = await server.protocol.addStatsChannel(statChannel);
            if(!await utils.handleProtocolResponse(resp, server.protocol, interaction)) return;

            await server.edit({ statChannels: resp.data });

            let message;
            if(statChannel.type === 'member-counter') {
                const onlinePlayers = await server.protocol.getOnlinePlayers();
                message = statChannel.names.members.replace('%count%', onlinePlayers.data.length);
            }
            else message = statChannel.names.online;

            try {
                await channel.setName(message);
            }
            catch(err) {
                if(err instanceof RateLimitError) {
                    // Channel rename is rate limited — schedule a deferred re-sync
                    UpdateStatsChannel.scheduleRetry(channel.id, err.retryAfter, statChannel, server.id, client);
                }
            }

            await interaction.editReplyTl(keys.commands.statchannel.success.add);
        }
        else if(subcommand === 'remove') {
            const channel = args[1];

            const statChannels = server.statChannels;
            const index = statChannels.findIndex(c => c.id === channel.id);
            if(index === -1) {
                return interaction.editReplyTl(keys.commands.chatchannel.warnings.channel_not_added);
            }

            const response = await server.protocol.removeStatsChannel(statChannels[index]);
            if(!await utils.handleProtocolResponse(response, server.protocol, interaction)) return;

            statChannels.splice(index, 1);
            await server.edit({ statChannels: statChannels });

            await interaction.editReplyTl(keys.commands.statchannel.success.remove);
        }
        else if(subcommand === 'list') {
            const type = args[1];

            let statChannels = server.statChannels;
            if(type && statChannels) statChannels = statChannels.filter(c => c.type === type);

            if(!statChannels?.length) {
                await interaction.editReplyTl(keys.commands.chatchannel.warnings.no_channels);
                return;
            }

            /** @type {PaginationPages} */
            const pages = {};

            for(const channel of statChannels) {
                const channelEmbed = getEmbed(
                    keys.commands.statchannel.success[`${channel.type}_list`],
                    ph.std(interaction),
                    {
                        channel: await interaction.guild.channels.fetch(channel.id),
                        name: channel.names.members,
                        offline_name: channel.names.offline,
                        online_name: channel.names.online,
                    },
                );

                const index = statChannels.indexOf(channel);
                const channelButton = getComponent(keys.commands.chatchannel.success.channel_button, {
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
