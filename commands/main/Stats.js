const fs = require('fs-extra');
const utils = require('../../api/utils');
const { keys, ph, addPh, getEmbed } = require('../../api/messages');
const AutocompleteCommand = require('../../structures/AutocompleteCommand');

class Stats extends AutocompleteCommand {

    constructor() {
        super('stats');
    }

    async autocomplete(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        const stats = await utils.searchStats(focused, subcommand);
        interaction.respond(stats).catch(() => console.log(keys.commands.stats.errors.could_not_autocomplete));
    }

    async execute(interaction, client, args) {
        let category = args[0];
        let stat = args[1];
        const user = interaction.mentions.users.first() ?? args[2];
        const argPlaceholder = { 'stat_category': category, 'username': user?.username ?? user };

        if(!category) {
            interaction.replyTl(keys.commands.stats.warnings.no_category);
            return;
        }
        else if(!stat) {
            interaction.replyTl(keys.commands.stats.warnings.no_stat);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.stats.warnings.no_username);
            return;
        }

        const statName = await utils.searchStats(stat, category, true, true, 1);
        argPlaceholder.stat_name = statName[0]?.name ?? stat;

        if(await settings.isDisabled(interaction.guildId, 'stats', category)) {
            interaction.replyTl(keys.commands.stats.warnings.category_disabled, argPlaceholder);
            return;
        }
        else if(await settings.isDisabled(interaction.guildId, 'stats', stat)) {
            interaction.replyTl(keys.commands.stats.warnings.stat_disabled, argPlaceholder);
            return;
        }

        const uuid = await utils.getUUID(user, interaction.guildId, interaction);
        if(!uuid) return;

        const worldPath = await utils.getWorldPath(interaction.guildId, interaction);
        if(!worldPath) return;

        const statFile = await ftp.get(`${worldPath}/stats/${uuid}.json`, `./userdata/stats/${uuid}.json`, interaction.guildId, interaction);
        if(!statFile) return;
        const statData = JSON.parse(statFile);

        try {
            const version = await utils.getVersion(interaction.guild.id, interaction) ?? 19;

            let statMatch;
            if(version <= 12) {
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
                interaction.replyTl(keys.commands.stats.warnings.no_match, argPlaceholder);
                return;
            }

            let statMessage;
            statMessage = addPh(keys.commands.stats.success.stat_message[category], argPlaceholder, { 'stat_value': statMatch });
            if(stat.includes('time')) {
                statMessage = addPh(
                    keys.commands.stats.success.stat_message.time,
                    argPlaceholder, { 'stat_value': (statMatch / 20 / 3600).toFixed(2) }, //Convert ticks to hours
                );
            }
            else if(stat.includes('_one_cm')) {
                statMessage = addPh(
                    keys.commands.stats.success.stat_message.distance,
                    argPlaceholder, { 'stat_value': (statMatch / 100).toFixed(2) },
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

            fs.access(`./resources/images/minecraft/${imgType}/${stat}.png`, err => {
                if(err) {
                    interaction.replyTl(keys.commands.stats.warnings.no_image, { 'stat_name': stat });
                    interaction.replyOptions({ embeds: [statEmbed] });
                    return;
                }
                interaction.replyOptions({
                    embeds: [statEmbed],
                    files: [`./resources/images/minecraft/${imgType}/${stat}.png`],
                });
            });
        }
        catch(err) {
            interaction.replyTl(keys.commands.stats.errors.could_not_parse, argPlaceholder, ph.error(err));
        }
    }
}

module.exports = Stats;