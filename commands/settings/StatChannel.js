import Command from '../../structures/Command.js';
import keys from '../../utilities/keys.js';
import { getComponent, getEmbed, ph } from '../../utilities/messages.js';
import Pagination from '../../structures/helpers/Pagination.js';
import * as utils from '../../utilities/utils.js';
import { GuildChannel } from 'discord.js';

export default class StatChannel extends Command {

    constructor() {
        super({
            name: 'statchannel',
            category: 'settings',
            requiresConnectedPlugin: true,
        });
    }


    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const subcommand = args[0];
        if(subcommand === 'add') {
            const type = args[1];
            /** @type {GuildChannel} */
            const channel = args[2];
            if(!channel.manageable) {
                return interaction.replyTl(keys.commands.statchannel.errors.not_manageable);
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
            await channel.setName(message);

            await interaction.replyTl(keys.commands.statchannel.success.add);
        }
        else if(subcommand === 'remove') {
            const channel = args[1];

            const statChannels = server.statChannels;
            const index = statChannels.findIndex(c => c.id === channel.id);
            if(index === -1) {
                return interaction.replyTl(keys.commands.chatchannel.warnings.channel_not_added);
            }

            const response = await server.protocol.removeStatsChannel(statChannels[index]);
            if(!await utils.handleProtocolResponse(response, server.protocol, interaction)) return;

            statChannels.splice(index, 1);
            await server.edit({ statChannels: statChannels });

            await interaction.replyTl(keys.commands.statchannel.success.remove);
        }
        else if(subcommand === 'list') {
            const filter = args[1];

            let statChannels = server.statChannels;
            if(filter && statChannels) statChannels = statChannels.filter(c => c.type === filter);

            if(!statChannels?.length) {
                await interaction.replyTl(keys.commands.chatchannel.warnings.no_channels);
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
                    page: { embeds: [channelEmbed] },
                    button: channelButton,
                };
            }

            const pagination = new Pagination(client, interaction, pages);
            return pagination.start();
        }
    }
}
