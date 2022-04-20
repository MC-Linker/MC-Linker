const fs = require('fs');
const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');
const { keys, ph, addPh, getEmbedBuilder } = require('../../api/messages');

function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    let imgType;
    if(subcommand === 'killed' || subcommand === 'killed_by') imgType = 'entities';
    else imgType = 'items';

    fs.readdir(`./resources/images/minecraft/${imgType}`, (err, images) => {
        const matchingImages = images.filter(image => image.includes(focused.replaceAll(' ', '_')));
        if(matchingImages.length >= 25) matchingImages.length = 25;

        const respondArray = [];
        matchingImages.forEach(image => {
            let formattedImage = image.replaceAll('.png', '');
            formattedImage = formattedImage.split('_').map(word => word.cap()).join(' ');

            respondArray.push({
                name: formattedImage,
                value: image.replaceAll('.png', ''),
            });
        });

        interaction.respond(respondArray).catch(() => console.log(keys.commands.stats.errors.could_not_autocomplete));
    });
}

async function execute(message, args) {
    let category = args[0];
    let stat = args[1];
    const user = message.mentions.users.first() ?? args[2];
    const argPlaceholder = { "stat_category": category, "stat_name": stat, "username": user?.username ?? user };

     if(!category) {
        message.respond(keys.commands.stats.warnings.no_category);
        return;
    } else if(!stat) {
        message.respond(keys.commands.stats.warnings.no_stat);
        return;
    } else if(!user) {
        message.respond(keys.commands.stats.warnings.no_username);
        return;
    }

    if(await settings.isDisabled(message.guildId, 'stats', category)) {
        message.respond(keys.commands.stats.warnings.category_disabled, argPlaceholder);
        return;
    } else if(await settings.isDisabled(message.guildId, 'stats', stat)) {
        message.respond(keys.commands.stats.warnings.stat_disabled, argPlaceholder);
        return;
    }

    const uuidv4 = await utils.getUUIDv4(user, message);
    if(!uuidv4) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const statFile = await ftp.get(`${worldPath}/stats/${uuidv4}.json`, `./userdata/stats/${uuidv4}.json`, message);
    if(!statFile) return;

    fs.readFile(`./userdata/stats/${uuidv4}.json`, 'utf8', async (err, statJson) => {
        if (err) {
            message.respond(keys.commands.stats.errors.could_not_read_file, ph.fromError(err));
            return;
        }

        try {
            const statData = JSON.parse(statJson);
            const version = await utils.getVersion(message.guild.id, message);

            let statMatch;
            if (version <= 12) {
                if(!stat.includes('.')) stat = `minecraft.${stat}`;
                statMatch = statData[`stat.${category}.${stat}`];
                stat = stat.split('.').pop();
            } else {
                const filteredCategory = Object.keys(statData.stats)?.find(key => key.endsWith(category));
                const filteredStat = Object.keys(statData.stats?.[filteredCategory]).find(key => key.endsWith(stat));
                statMatch = statData.stats?.[filteredCategory]?.[filteredStat];

                stat = stat.split(':').pop();
                category = category.split(':').pop();
            }

            if (!statMatch) {
                message.respond(keys.commands.stats.warnings.no_match, argPlaceholder);
                return;
            }

            let statMessage;
            statMessage = addPh(keys.commands.stats.success.stat_message[category], argPlaceholder, { "stat_value": statMatch });
            if (stat === 'play_time' || stat === 'time_played') {
                statMessage = addPh(
                    keys.commands.stats.success.stat_message.time_played,
                    argPlaceholder, { "stat_value": (statMatch / 20 / 3600).toFixed(2) } //Convert ticks to hours
                );
            }

            const statEmbed = getEmbedBuilder(
                keys.commands.stats.success.final,
                ph.fromStd(message),
                argPlaceholder,
                { "stat_message": statMessage }
            );

            let imgType;
            if(category === 'killed' || category === 'killed_by') imgType = 'entities';
            else imgType = 'items';

            fs.access(`./resources/images/minecraft/${imgType}/${stat}.png`, err => {
                if (err) {
                    message.respond(keys.commands.stats.warnings.no_image, { "stat_name": stat });
                    message.replyOptions({ embeds: [statEmbed] });
                    return;
                }
                message.replyOptions({ embeds: [statEmbed], files: [`./resources/images/minecraft/${imgType}/${stat}.png`] });
            });
        } catch (err) {
            message.respond(keys.commands.stats.errors.could_not_parse, argPlaceholder, ph.fromError(err));
        }
    });
}

module.exports = { execute, autocomplete };