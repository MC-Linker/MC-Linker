const fs = require('fs');
const Discord = require('discord.js');
const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');

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

        interaction.respond(respondArray).catch(err => console.log(`Could not respond to autocomplete ${interaction.commandName}`, err));
    });
}

async function execute(message, args) {
    const username = message.mentions.users.first()?.tag ?? args[0];
    let category = args[1];
    let stat = args[2];

    if(!username) {
        console.log(`${message.member.user.tag} executed /stats without username in ${message.guild.name}`);
        message.reply(':warning: Please specify the player.');
        return;
    } else if(!category) {
        console.log(`${message.member.user.tag} executed /stats without statCategory in ${message.guild.name}`);
        message.reply(':warning: Please specify the stat category.\n(`custom`, `mined`, `broken`, `crafted`, `used`, `picked_up`, `dropped`, `killed`, `killed_by`)');
        return;
    } else if(!stat) {
        console.log(`${message.member.user.tag} executed /stats without stat in ${message.guild.name}`);
        message.reply(':warning: Please specify the stat.');
        return;
    }

    console.log(`${message.member.user.tag} executed /stats ${username} ${category} ${stat} in ${message.guild.name}`);

    if(await settings.isDisabled(message.guildId, 'stats', category)) {
        console.log(`Category [${category}] disabled.`);
        message.reply(`:no_entry: Stat category [**${category}**] disabled!`);
        return;
    }
    if(await settings.isDisabled(message.guildId, 'stats', stat)) {
        console.log(`Stat [${stat}] disabled.`);
        message.reply(`:no_entry: Stat [**${stat}**] disabled!`);
        return;
    }

    const uuidv4 = await utils.getUUIDv4(args[0], message.mentions.users.first()?.id, message);
    if(!uuidv4) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const statFile = await ftp.get(`${worldPath}/stats/${uuidv4}.json`, `./userdata/stats/${uuidv4}.json`, message);
    if(!statFile) return;

    fs.readFile(`./userdata/stats/${uuidv4}.json`, 'utf8', async (err, statJson) => {
        if (err) {
            message.reply('<:Error:849215023264169985> Could not find stat file. Member most likely never joined the server.')
            console.log('Error reading stat file from disk: ', err);
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
                const filteredCategory = statData.stats.find(key => key.endsWith(category));
                const filteredStat = statData.stats?.[filteredCategory].find(key => key.endsWith(stat));
                statMatch = statData.stats?.[filteredCategory]?.[filteredStat];

                stat = stat.split(':').pop();
                category = category.split(':').pop();
            }

            if (!statMatch) {
                console.log("No Match found!");
                message.reply(':warning: Stat is either 0 or misspelled!');
                return;
            }

            let statMessage;
            if (category === 'killed_by') statMessage = `has been killed **${statMatch}** times by a **${stat}**`;
            else if (stat === 'play_time' || stat === 'time_played') statMessage = `has played for **${(statMatch / 20 / 3600).toFixed(3)}** hours`;
            else if (category === 'custom') statMessage = `**${stat} ${statMatch}**`;
            else statMessage = `has **${category} ${statMatch} ${stat}s**`;

            const statEmbed = new Discord.MessageEmbed()
                .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                .setColor('DEFAULT')
                .addField(username, statMessage);

            console.log(`Sent stat ${category} ${stat} of Player: ${username}`);

            let imgType;
            if(category === 'killed' || category === 'killed_by') imgType = 'entities';
            else imgType = 'items';

            fs.access(`./resources/images/minecraft/${imgType}/${stat}.png`, err => {
                if (err) {
                    console.log(`No Image available for ${stat}`);
                    message.reply({ embeds: [statEmbed] });
                    return;
                }
                statEmbed.setImage(`attachment://${stat}.png`);
                message.reply({ embeds: [statEmbed], files: [`./resources/images/minecraft/${imgType}/${stat}.png`] });
            });
        } catch (err) {
            console.log('Error parsing Stat JSON string: ', err);
            message.reply(`<:Error:849215023264169985> ${username} has never done anything in this category.`);
        }
    });
}

module.exports = { execute, autocomplete };