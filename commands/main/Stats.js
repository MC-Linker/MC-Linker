import fs from 'fs-extra';
import * as utils from '../../utilities/utils.js';
import { formatDistance, formatDuration } from '../../utilities/utils.js';
import { addPh, getEmbed, ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import { FilePath } from '../../structures/Protocol.js';

export default class Stats extends AutocompleteCommand {
    constructor() {
        super({
            name: 'stats',
            requiresUserIndex: 2,
            category: 'main',
        });
    }

    autocomplete(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        const stats = utils.searchStats(focused, subcommand);
        interaction.respond(stats).catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.interaction(interaction), ph.error(err)));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        let category = args[0];
        let stat = args[1];
        const user = args[2];

        const argPlaceholder = { 'stat_category': category, 'username': user.username };

        const statName = utils.searchStats(stat, category, true, true, 1);
        argPlaceholder.stat_name = statName[0]?.name ?? stat;

        if(server.settings.isDisabled('stats', category)) {
            return interaction.replyTl(keys.commands.stats.no_access.category_disabled, argPlaceholder);
        }
        else if(server.settings.isDisabled('stats', stat)) {
            return interaction.replyTl(keys.commands.stats.no_access.stat_disabled, argPlaceholder);
        }

        const statFile = await server.protocol.get(FilePath.Stats(server.worldPath, user.uuid), `./download-cache/stats/${user.uuid}.json`);
        if(!await utils.handleProtocolResponse(statFile, server.protocol, interaction, {
            404: keys.api.command.errors.could_not_download_user_files,
        }, { category: 'stats' })) return;
        const statData = JSON.parse(statFile.data.toString());

        try {
            let statMatch;
            if(server.version <= 12) {
                if(!stat.includes('.')) stat = `minecraft.${stat}`;
                statMatch = statData[`stat.${category}.${stat}`];
                stat = stat.split('.').pop();
            }
            else {
                const filteredCategory = Object.keys(statData.stats)?.find(key => key.endsWith(category));
                const filteredStat = Object.keys(statData.stats?.[filteredCategory]).find(key => key.endsWith(stat));
                statMatch = statData.stats?.[filteredCategory]?.[filteredStat];

                stat = stat.split(':').pop();
                category = category.split(':').pop();
            }

            if(!statMatch) {
                return interaction.replyTl(keys.commands.stats.warnings.no_match, argPlaceholder);
            }

            let statMessage;
            statMessage = addPh(keys.commands.stats.success.stat_message[category], argPlaceholder, { 'stat_value': statMatch });
            if(stat.includes('time')) {
                statMessage = addPh(
                    keys.commands.stats.success.stat_message.time,
                    argPlaceholder, { 'stat_value': formatDuration(statMatch / 20) }, //Convert ticks to hours
                );
            }
            else if(stat.includes('_one_cm')) {
                statMessage = addPh(
                    keys.commands.stats.success.stat_message.distance,
                    argPlaceholder, { 'stat_value': formatDistance(statMatch) },
                );
            }

            const statEmbed = getEmbed(
                keys.commands.stats.success.final,
                ph.std(interaction),
                argPlaceholder, { 'stat_message': statMessage, 'stat_value': stat },
            );

            let imgType;
            if(category === 'killed' || category === 'killed_by') imgType = 'entities';
            else imgType = 'items';

            fs.access(`./resources/images/${imgType}/${stat}.png`, err => {
                if(err) {
                    console.log(addPh(keys.commands.stats.warnings.no_image.console, { 'stat_name': stat }));
                    interaction.replyOptions({ embeds: [statEmbed] });
                    return;
                }
                interaction.replyOptions({
                    embeds: [statEmbed],
                    files: [`./resources/images/${imgType}/${stat}.png`],
                });
            });
        }
        catch(err) {
            await interaction.replyTl(keys.commands.stats.errors.could_not_parse, argPlaceholder);
        }
    }
}
