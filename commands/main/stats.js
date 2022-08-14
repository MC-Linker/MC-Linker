const fs = require('fs-extra');
const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');
const { keys, ph, addPh, getEmbed } = require('../../api/messages');

async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    const stats = await utils.searchStats(focused, subcommand);
    interaction.respond(stats).catch(() => console.log(keys.commands.stats.errors.could_not_autocomplete));
}

async function execute(message, args) {
    let category = args[0];
    let stat = args[1];
    const user = message.mentions.users.first() ?? args[2];
    const argPlaceholder = { 'stat_category': category, 'username': user?.username ?? user };

    if(!category) {
        message.respond(keys.commands.stats.warnings.no_category);
        return;
    }
    else if(!stat) {
        message.respond(keys.commands.stats.warnings.no_stat);
        return;
    }
    else if(!user) {
        message.respond(keys.commands.stats.warnings.no_username);
        return;
    }

    const statName = await utils.searchStats(stat, category, true, true, 1);
    argPlaceholder.stat_name = statName[0]?.name ?? stat;

    if(await settings.isDisabled(message.guildId, 'stats', category)) {
        message.respond(keys.commands.stats.warnings.category_disabled, argPlaceholder);
        return;
    }
    else if(await settings.isDisabled(message.guildId, 'stats', stat)) {
        message.respond(keys.commands.stats.warnings.stat_disabled, argPlaceholder);
        return;
    }

    const uuid = await utils.getUUID(user, message.guildId, message);
    if(!uuid) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const statFile = await ftp.get(`${worldPath}/stats/${uuid}.json`, `./userdata/stats/${uuid}.json`, message.guildId, message);
    if(!statFile) return;
    const statData = JSON.parse(statFile);

    try {
        const version = await utils.getVersion(message.guild.id, message) ?? 19;

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
            message.respond(keys.commands.stats.warnings.no_match, argPlaceholder);
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
            ph.std(message),
            argPlaceholder, { 'stat_message': statMessage, 'stat_value': stat },
        );

        let imgType;
        if(category === 'killed' || category === 'killed_by') imgType = 'entities';
        else imgType = 'items';

        fs.access(`./resources/images/minecraft/${imgType}/${stat}.png`, err => {
            if(err) {
                message.respond(keys.commands.stats.warnings.no_image, { 'stat_name': stat });
                message.replyOptions({ embeds: [statEmbed] });
                return;
            }
            message.replyOptions({
                embeds: [statEmbed],
                files: [`./resources/images/minecraft/${imgType}/${stat}.png`],
            });
        });
    }
    catch(err) {
        message.respond(keys.commands.stats.errors.could_not_parse, argPlaceholder, ph.error(err));
    }
}

module.exports = { execute, autocomplete };