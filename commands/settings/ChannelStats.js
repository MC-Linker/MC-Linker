import Command from '../../structures/Command.js';
import keys from '../../api/keys.js';
import { getComponent, getEmbed, ph } from '../../api/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import * as utils from '../../api/utils.js';

export default class ChannelStats extends Command {

    constructor() {
        super({
            name: 'channel-stats',
            category: 'settings',
            requiresConnectedPlugin: true,
        });
    }


    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        const settings = await client.serverSettingsConnections.getOrConnect(server.id);

        if(subcommand === 'add') {
            const type = args[1];
            const channel = args[2];

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

            const response = await server.protocol.addStatsChannel(statChannel);
            if(!await utils.handleProtocolResponse(response, server.protocol, interaction)) return;

            settings.statsChannels.push(statChannel);
            await settings.edit({ statsChannels: settings.statsChannels });

            await interaction.replyTl(keys.commands['channel-stats'].success.add);
        }
        else if(subcommand === 'remove') {
            const channel = args[1];

            const statsChannels = settings.statsChannels;
            const index = statsChannels.findIndex(c => c.id === channel.id);
            if(index === -1) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.channel_not_added);
            }

            const response = await server.protocol.removeStatsChannel(statsChannels[index]);
            if(!await utils.handleProtocolResponse(response, server.protocol, interaction)) return;

            statsChannels.splice(index, 1);
            await settings.edit({ statsChannels });

            await interaction.replyTl(keys.commands['channel-stats'].success.remove);
        }
        else if(subcommand === 'list') {
            const filter = args[1];

            let statsChannels = settings.statsChannels;
            if(filter) statsChannels = statsChannels.filter(c => c.type === filter);

            if(statsChannels.length === 0) {
                await interaction.replyTl(keys.commands.chatchannel.warnings.no_channels);
                return;
            }

            /** @type {PaginationPages} */
            const pages = {};

            for(const channel of statsChannels) {
                const key = channel.type === 'member-counter' ? 'member-counter' : 'status';
                const channelEmbed = getEmbed(
                    keys.commands['channel-stats'].success.list[key],
                    ph.std(interaction),
                    {
                        channel: await interaction.guild.channels.fetch(channel.id),
                        name: channel.names.members,
                        offline_name: channel.names.offline,
                        online_name: channel.names.online,
                    },
                );

                const index = statsChannels.indexOf(channel);
                const channelButton = getComponent(keys.commands.chatchannel.success.channel_button, {
                    index1: index + 1,
                    index: index,
                });

                pages[channelButton.data.custom_id] = {
                    page: { embeds: [channelEmbed] },
                    button: channelButton,
                };
            }

            const pagination = new Pagination(client, interaction, pages);
            return pagination.start();
        }
    }
}
