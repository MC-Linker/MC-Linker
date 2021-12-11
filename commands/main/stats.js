const fs = require('fs');
const ftp = require('../../api/ftp');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'stats',
    aliases: ['stat'],
    usage: 'stats <@mention>/<ingamename> <Statcategory **id**> <Statitem/block/entity **id**> ',
    example: '/stats @Lianecx mined iron_ore **//** /stats @Memer custom play_time **//** /stats xXgamerboyyXx killed blaze',
    description: "Look at your and other member's minecraft server stats.\n All Categories (ids) can be found in this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names)!\nAll stats of the `custom` category can be found [here](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names).",
    data: new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Look at your and other member\'s minecraft server stats.')
            .addSubcommand(subcommand =>
                subcommand.setName('custom')
                .setDescription('A multitude of generic statistics related to a player\'s actions.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set a custom stat. All stats of the custom category => /help stats')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('mined')
                .setDescription('Statistic related to the number of blocks a player mined.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set a block (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('broken')
                .setDescription('Statistics related to the number of items a player ran their durability negative.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an item (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('crafted')
                .setDescription('Statistics related to the number of items crafted, smelted, etc.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an item (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('used')
                .setDescription('Statistics related to the number of block or item used.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an item or block (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('picked_up')
                .setDescription('Statistics related to the number of dropped items a player picked up.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an item (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('dropped')
                .setDescription('Statistics related to the number of items that dropped.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an item (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('killed')
                .setDescription('Statistics related to the number of entities a player killed.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an entity (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('killed_by')
                .setDescription('Statistics related to the times of a player being killed by entities.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set an entity (english, space = _ )')
                    .setRequired(true)
                ).addUserOption(option =>
                    option.setName('user')
                    .setDescription('Set the user you want to get the stats from.')
                    .setRequired(true)
                )
            ),
    autocomplete(interaction) {
        //TODO minecraft-data npm?
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();
        fs.readdir('./images/minecraft', (err, images) => {
            const matchingItems = images.filter(image => image.includes(focused.replaceAll(' ', '_')));

            const respondArray = [];
            matchingItems.forEach(item => {
                const formattedItem = item.replaceAll('_', ' ').replaceAll('.png', '').cap();

                respondArray.push({
                    name: formattedItem,
                    value: item.replaceAll('.png', ''),
                });
            });
            if(respondArray.length >= 25) respondArray.length = 25;
            interaction.respond(respondArray);
        });
    },
    async execute(message, args) {
        const username = message.mentions.users.first()?.tag ?? args[0];
        const category = args[1];
        const stat = args[2];

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

        const uuidv4 = await utils.getUUIDv4(args[0], message.mentions.users.first()?.id, message);
        if(!uuidv4) return;

        const categoryDisabled = fs.existsSync(`./disable/stats/${message.guild.id}_${category}`);
        if(categoryDisabled === true) {
            console.log(`Category [${category}] disabled.`);
            message.reply(`:no_entry: Stat category [**${category}**] disabled!`);
            return;
        }
        const statDisabled = fs.existsSync(`./disable/stats/${message.guild.id}_${stat}`);
        if(statDisabled === true) {
            console.log(`Object [${stat}] disabled.`);
            message.reply(`:no_entry: Stat [**${stat}**] disabled!`);
            return;
        }

        const worldPath = await utils.getWorldPath(message.guildId, message);
        if(!worldPath) return;

        const statFile = await ftp.get(`${worldPath}/stats/${uuidv4}.json`, `./stats/${uuidv4}.json`, message);
        if(!statFile) return;

        fs.readFile(`./stats/${uuidv4}.json`, 'utf8', async (err, statJson) => {
            if (err) {
                message.reply('<:Error:849215023264169985> Could not find stat file. Member most likely never joined the server.')
                console.log('Error reading stat file from disk: ', err);
                return;
            }
            try {
                const statData = JSON.parse(statJson);
                const version = await utils.getVersion(message.guild.id, message);

                let statMatch;
                if (version >= 13) statMatch = statData.stats[`minecraft:${category}`][`minecraft:${stat}`];
                else if (version <= 12) statMatch = statData[`stat.${category}.minecraft.${stat}`];

                if (statMatch) {
                    let statMessage;
                    if (category === 'killed_by') statMessage = `was killed **${statMatch}** times by a **${stat}**`;
                    else if (stat === 'play_time' || stat === 'time_played') statMessage = `has played for **${((statMatch / 20) / 3600).toFixed(3)}** hours`;
                    else if (category === 'custom') statMessage = `**${stat} ${statMatch}**`;
                    else statMessage = `has **${category} ${statMatch} ${stat}s**`;

                    const statEmbed = new Discord.MessageEmbed()
                        .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                        .setColor('DEFAULT')
                        .addField(username, statMessage);

                    console.log(`Sent stat ${category} ${stat} of Player: ${username}`);
                    fs.access(`./images/${stat}}.png`, err => {
                        if (err) {
                            console.log(`No Image available for ${stat}`);
                            message.reply({ embeds: [statEmbed] });
                            return;
                        }
                        statEmbed.setImage(`attachment://${stat}.png`);
                        message.reply({ embeds: [statEmbed], files: [`./images/${stat}.png`] });
                    });
                } else {
                    console.log("No Match found!");
                    message.reply(':warning: Stat is either 0 or misspelled!');
                }
            } catch (err) {
                console.log('Error parsing Stat JSON string: ', err);
                message.reply(`<:Error:849215023264169985> ${username} has never done anything in this category.`);
            }
        });
    }
}