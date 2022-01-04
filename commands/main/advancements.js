const fs = require('fs');
const ftp = require('../../api/ftp');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const { SlashCommandBuilder, time } = require('@discordjs/builders');

module.exports = {
    name: 'advancements',
    aliases: ['am', 'advancement', 'ams'],
    usage: 'advancements <@mention>/<in-game name> <advancement-tab> <advancement name or id>',
    example: '/advancements @Lianecx story Diamonds! **//** /advancements @Memer adventure Bullseye',
    description: 'Look up your and other\'s unlocked/completed recipes/advancements. You can find a list of all advancement (ids) [here](https://minecraft.fandom.com/wiki/Advancement#List_of_advancements).',
    data: new SlashCommandBuilder()
        .setName('advancements')
        .setDescription('Look up your unlocked/completed advancements.')
        .addSubcommand(subcommand =>
            subcommand.setName('story')
                .setDescription('The heart and story of the game')
                .addStringOption(option =>
                    option.setName('advancement')
                        .setDescription('Set the advancement')
                        .setRequired(true)
                        .setAutocomplete(true)
                ).addUserOption(option =>
                option.setName('user')
                    .setDescription('Set the user you want to get the advancement from.')
                    .setRequired(true)
            )
        ).addSubcommand(subcommand =>
            subcommand.setName('nether')
                .setDescription('Bring summer clothes')
                .addStringOption(option =>
                    option.setName('advancement')
                        .setDescription('Set the advancement')
                        .setRequired(true)
                        .setAutocomplete(true)
                ).addUserOption(option =>
                option.setName('user')
                    .setDescription('Set the user you want to get the advancement from.')
                    .setRequired(true)
            )
        ).addSubcommand(subcommand =>
            subcommand.setName('end')
                .setDescription('Or the beginning?')
                .addStringOption(option =>
                    option.setName('advancement')
                        .setDescription('Set the advancement')
                        .setRequired(true)
                        .setAutocomplete(true)
                ).addUserOption(option =>
                option.setName('user')
                    .setDescription('Set the user you want to get the advancement from.')
                    .setRequired(true)
            )
        ).addSubcommand(subcommand =>
            subcommand.setName('adventure')
                .setDescription('Adventure, exploration, and combat')
                .addStringOption(option =>
                    option.setName('advancement')
                        .setDescription('Set the advancement')
                        .setRequired(true)
                        .setAutocomplete(true)
                ).addUserOption(option =>
                option.setName('user')
                    .setDescription('Set the user you want to get the advancement from.')
                    .setRequired(true)
            )
        ).addSubcommand(subcommand =>
            subcommand.setName('husbandry')
                .setDescription('The world is full of friends and food')
                .addStringOption(option =>
                    option.setName('advancement')
                        .setDescription('Set the advancement')
                        .setRequired(true)
                        .setAutocomplete(true)
                ).addUserOption(option =>
                option.setName('user')
                    .setDescription('Set the user you want to get the advancement from.')
                    .setRequired(true)
            )
        ),
    advancementTitles: {
        categories: [
            {
                name: 'story',
                titles: [
                    {
                        name: 'Minecraft',
                        value: 'root'
                    },
                    {
                        name: 'Stone Age',
                        value: 'mine_stone'
                    },
                    {
                        name: 'Getting an Upgrade',
                        value: 'upgrade_tools'
                    },
                    {
                        name: 'Acquire Hardware',
                        value: 'smelt_iron'
                    },
                    {
                        name: 'Suit Up',
                        value: 'obtain_armor'
                    },
                    {
                        name: 'Hot Stuff',
                        value: 'lava_bucket'
                    },
                    {
                        name: 'Isn\'t It Iron Pick',
                        value: 'iron_tools'
                    },
                    {
                        name: 'Not Today, Thank You',
                        value: 'deflect_arrow'
                    },
                    {
                        name: 'Ice Bucket Challenge',
                        value: 'form_obsidian'
                    },
                    {
                        name: 'Diamonds!',
                        value: 'mine_diamond'
                    },
                    {
                        name: 'We Need to Go Deeper',
                        value: 'enter_the_nether'
                    },
                    {
                        name: 'Cover Me With Diamonds',
                        value: 'shiny_gear'
                    },
                    {
                        name: 'Zombie Doctor',
                        value: 'cure_zombie_villager'
                    },
                    {
                        name: 'Eye Spy',
                        value: 'follow_ender_eye'
                    },
                    {
                        name: 'The End?',
                        value: 'enter_the_end'
                    }
                ]
            },
            {
                name: 'nether',
                titles: [
                    {
                        name: 'Nether',
                        value: 'root'
                    },
                    {
                        name: 'Return to Sender',
                        value: 'return_to_sender'
                    },
                    {
                        name: 'Those Were the Days',
                        value: 'find_bastion'
                    },
                    {
                        name: 'Hidden in the Depths',
                        value: 'obtain_ancient_debris'
                    },
                    {
                        name: 'Subspace Bubble',
                        value: 'fast_travel'
                    },
                    {
                        name: 'A Terrible Fortress',
                        value: 'find_fortress'
                    },
                    {
                        name: 'Who is Cutting Onions?',
                        value: 'obtain_crying_obsidian'
                    },
                    {
                        name: 'Oh Shiny',
                        value: 'distract_piglin'
                    },
                    {
                        name: 'This Boat Has Legs',
                        value: 'ride_strider'
                    },
                    {
                        name: 'Uneasy Alliance',
                        value: 'uneasy_alliance'
                    },
                    {
                        name: 'War Pigs',
                        value: 'loot_bastion'
                    },
                    {
                        name: 'Country Lode, Take Me Home',
                        value: 'use_lodestone'
                    },
                    {
                        name: 'Cover Me in Debris',
                        value: 'netherite_armor'
                    },
                    {
                        name: 'Spooky Scary Skeleton',
                        value: 'get_wither_skull'
                    },
                    {
                        name: 'Into Fire',
                        value: 'obtain_blaze_rod'
                    },
                    {
                        name: 'Not Quite "Nine" Lives',
                        value: 'charge_respawn_anchor'
                    },
                    {
                        name: 'Feels like home',
                        value: 'ride_strider_in_overworld_lava'
                    },
                    {
                        name: 'Withering Heights',
                        value: 'summon_wither'
                    },
                    {
                        name: 'Local Brewery',
                        value: 'brew_potion'
                    },
                    {
                        name: 'Bring Home the Beacon',
                        value: 'create_beacon'
                    },
                    {
                        name: 'A Furious Cocktail',
                        value: 'all_potions'
                    },
                    {
                        name: 'Beaconator',
                        value: 'create_full_beacon'
                    },
                    {
                        name: 'How Did We Get Here?',
                        value: 'all_effects'
                    }
                ]
            },
            {
                name: 'end',
                titles: [
                    {
                        name: 'The End?',
                        value: 'root'
                    },
                    {
                        name: 'Free the End',
                        value: 'kill_dragon'
                    },
                    {
                        name: 'The Next Generation',
                        value: 'dragon_egg'
                    },
                    {
                        name: 'Remote Getaway',
                        value: 'enter_end_gateway'
                    },
                    {
                        name: 'The End... Again...',
                        value: 'respawn_dragon'
                    },
                    {
                        name: 'You Need a Mint',
                        value: 'You Need a Mint'
                    },
                    {
                        name: 'The City at the End of the Game',
                        value: 'find_end_city'
                    },
                    {
                        name: 'Sky\'s the Limit',
                        value: 'elytra'
                    },
                    {
                        name: 'Great View From Up Here',
                        value: 'levitate'
                    }
                ]
            },
            {
                name: 'adventure',
                titles: [
                    {
                        name: 'Adventure',
                        value: 'root'
                    },
                    {
                        name: 'Voluntary Exile',
                        value: 'voluntary_exile'
                    },
                    {
                        name: 'Is It a Bird?',
                        value: 'spyglass_at_parrot'
                    },
                    {
                        name: 'Monster Hunter',
                        value: 'kill_a_mob'
                    },
                    {
                        name: 'What a Deal!',
                        value: 'trade'
                    },
                    {
                        name: 'Sticky Situation',
                        value: 'honey_block_slide'
                    },
                    {
                        name: 'Ol\' Betsy',
                        value: 'ol_betsy'
                    },
                    {
                        name: 'Surge Protector',
                        value: 'lightning_rod_with_villager_no_fire'
                    },
                    {
                        name: 'Caves & Cliffs',
                        value: 'sleep_in_bed'
                    },
                    {
                        name: 'Hero of the Village',
                        value: 'hero_of_the_village'
                    },
                    {
                        name: 'A Throwaway Joke',
                        value: 'throw_trident'
                    },
                    {
                        name: 'Take Aim',
                        value: 'shoot_arrow'
                    },
                    {
                        name: 'Monsters Hunted',
                        value: 'kill_all_mobs'
                    },
                    {
                        name: 'Postmortal',
                        value: 'totem_of_undying'
                    },
                    {
                        name: 'Hired Help',
                        value: 'summon_iron_golem'
                    },
                    {
                        name: 'Star Trader',
                        value: 'trade_at_world_height'
                    },
                    {
                        name: 'Two Birds, One Arrow',
                        value: 'two_birds_one_arrow'
                    },
                    {
                        name: 'Who\'s the Pillager Now?',
                        value: 'whos_the_pillager_now'
                    },
                    {
                        name: 'Arbalistic',
                        value: 'arbalistic'
                    },
                    {
                        name: 'Adventuring Time',
                        value: 'adventuring_time'
                    },
                    {
                        name: 'Sound of Music',
                        value: 'play_jukebox_in_meadows'
                    },
                    {
                        name: 'Light as a Rabbit',
                        value: 'walk_on_powder_snow_with_leather_boots'
                    },
                    {
                        name: 'Is It a Plane?',
                        value: 'spyglass_at_dragon'
                    },
                    {
                        name: 'Very Very Frightening',
                        value: 'very_very_frightening'
                    },
                    {
                        name: 'Sniper Duel',
                        value: 'sniper_duel'
                    },
                    {
                        name: 'Bullseye',
                        value: 'bullseye'
                    },
                ]
            },
            {
                name: 'husbandry',
                titles: [
                    {
                        name: 'Husbandry',
                        value: 'root'
                    },
                    {
                        name: 'Bee Our Guest',
                        value: 'safely_harvest_honey'
                    },
                    {
                        name: 'The Parrots and the Bats',
                        value: 'breed_an_animal'
                    },
                    {
                        name: 'Whatever Floats Your Goat!',
                        value: 'ride_a_boat_with_a_goat'
                    },
                    {
                        name: 'Best Friends Forever',
                        value: 'tame_an_animal'
                    },
                    {
                        name: 'Glow and Behold!',
                        value: 'make_a_sign_glow'
                    },
                    {
                        name: 'Fishy Business',
                        value: 'fishy_business'
                    },
                    {
                        name: 'Total Beelocation',
                        value: 'silk_touch_nest'
                    },
                    {
                        name: 'A Seedy Place',
                        value: 'plant_seed'
                    },
                    {
                        name: 'Wax On',
                        value: 'wax_on'
                    },
                    {
                        name: 'Two by Two',
                        value: 'bred_all_animals'
                    },
                    {
                        name: 'A Complete Catalogue',
                        value: 'complete_catalogue'
                    },
                    {
                        name: 'Tactical Fishing',
                        value: 'tactical_fishing'
                    },
                    {
                        name: 'A Balanced Diet',
                        value: 'balanced_diet'
                    },
                    {
                        name: 'Serious Dedication',
                        value: 'obtain_netherite_hoe'
                    },
                    {
                        name: 'Wax Off',
                        value: 'wax_off'
                    },
                    {
                        name: 'The Cutest Predator',
                        value: 'axolotl_in_a_bucket'
                    },
                    {
                        name: 'The Healing Power of Friendship!',
                        value: 'kill_axolotl_target'
                    }
                ]
            }
        ]
    },
    autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        //Get Advancement Titles from this.advancementTitles
        const advancementTitles = this.advancementTitles.categories.find(category => category.name.toLowerCase() === subcommand).titles;
        const matchingTitles = advancementTitles.filter(title => title.name.toLowerCase().includes(focused));
        if(matchingTitles.length >= 25) matchingTitles.length = 25;

        const respondArray = [];
        matchingTitles.forEach(title =>
            respondArray.push({
                name: title.name,
                value: title.value
            })
        );

        interaction.respond(respondArray);
    },
    async execute(message, args) {
        const username = message.mentions.users.first()?.tag ?? args[0];
        args.shift();
        const category = args?.shift().toLowerCase();
        let advancement = args?.join(' ').toLowerCase();

        if(!username) {
            console.log(`${message.member.user.tag} executed /advancements without username in ${message.guild.name}`);
            message.reply(':warning: Please specify the player you want to unban.');
            return;
        } else if(!category) {
            console.log(`${message.member.user.tag} executed /advancements without tab in ${message.guild.name}`);
            message.reply(':warning: Please specify the advancement category.\n(`story`, `nether`, `end`, `adventure`, `husbandry`)');
            return;
        } else if(!advancement) {
            console.log(`${message.member.user.tag} executed /advancements without advancement in ${message.guild.name}`);
            message.reply(':warning: Please specify the advancement name or id. More help with `/help advancements`');
            return;
        }

        //Get Advancement Title from this.advancementTitles
        const advancementTitles = this.advancementTitles.categories.find(amCategory => amCategory.name.toLowerCase() === category)?.titles;
        const advancementId = advancementTitles?.find(title => title.name.toLowerCase() === advancement)?.value;
        advancement = advancementId ?? advancement;

        const uuidv4 = await utils.getUUIDv4(username, message.mentions.users.first()?.id, message);
        if(!uuidv4) return;

        console.log(`${message.member.user.tag} executed /advancements ${username} ${category} ${advancement} in ${message.guild.name}`);

        const categoryDisabled = fs.existsSync(`./disable/advancements/${message.guild.id}_${category}`);
        if(categoryDisabled) {
            console.log(`Advancement category [${category}] disabled.`);
            message.reply(`:no_entry: Advancement category [**${category}**] disabled!`);
            return;
        }
        const advancementDisabled = fs.existsSync(`./disable/advancements/${message.guild.id}_${advancement}`);
        if(advancementDisabled) {
            console.log(`Advancement [${advancement}] disabled.`);
            message.reply(`:no_entry: Advancement [**${advancement}**] disabled!`);
            return;
        }

        const worldPath = await utils.getWorldPath(message.guildId, message);
        if(!worldPath) return;

        const amFile = await ftp.get(`${worldPath}/advancements/${uuidv4}.json`, `./advancements/${uuidv4}.json`, message);
        if(!amFile) return;

        fs.readFile(`./advancements/${uuidv4}.json`, 'utf8', async (err, advancementJson) => {
            if(err) {
                message.reply('<:Error:849215023264169985> Could not read advancement file. Please try again.');
                console.log('Error reading stat file from disk: ', err);
                return;
            }

            const advancementData = JSON.parse(advancementJson);

            let advancementTitle;
            let advancementDesc;
            try {
                const langData = JSON.parse(await fs.promises.readFile('./lang/english.json', 'utf-8'));
                advancementTitle = langData[`advancements.${category}.${advancement}.title`];
                advancementDesc = langData[`advancements.${category}.${advancement}.description`];
                if(!advancementTitle) {
                    advancementDesc = 'No description available...'
                    advancementTitle = `${category} ${advancement}`;
                }
            } catch(err) {
                advancementDesc = 'No description available...'
                advancementTitle = `${category} ${advancement}`;
            }

            const letters = advancementTitle.split('');
            let equals = '';
            for(const {} of letters) equals += '=';

            const baseEmbed = new Discord.MessageEmbed()
                .setColor('LUMINOUS_VIVID_PINK')
                .setTitle(username)
                .addField(`${equals}\n${advancementTitle}`, `**${equals}**`)
                .setDescription(advancementDesc)
                .setImage('https://cdn.discordapp.com/attachments/844493685244297226/849604323264430140/unknown.png');

            try {
                let amEmbed;
                if(category === 'recipes') {
                    const allAdvancements = Object.keys(advancementData);
                    const filteredAdvancement = allAdvancements.find(key => key.includes(`recipes/`) && key.endsWith(`/${advancement}`));

                    const criteria = Object.keys(advancementData[filteredAdvancement]['criteria']).join('');
                    const date = advancementData[filteredAdvancement]['criteria'][criteria];
                    const done = advancementData[filteredAdvancement]['done'];

                    amEmbed = baseEmbed.addField('Requirement', criteria).addField('unlocked on', time(new Date(date)));

                    if(!done) amEmbed.setFooter({ text: 'Advancement not unlocked/completed.', iconURL: 'https://cdn.discordapp.com/emojis/849215023264169985.png' });
                    else amEmbed.setFooter({ text: 'Advancement completed/unlocked.', iconURL: 'https://cdn.discordapp.com/emojis/849224496232660992.png' });
                } else {
                    const allAdvancements = Object.keys(advancementData);
                    const filteredAdvancement = allAdvancements.find(key => key.includes(category) && key.endsWith(advancement));

                    const keys = Object.keys(advancementData[filteredAdvancement]['criteria']);
                    const done = advancementData[filteredAdvancement]['done'];

                    let counter = 0;
                    let amString = '';
                    for (const key of keys) {
                        const date = advancementData[filteredAdvancement]['criteria'][key];
                        amString += `\n**Requirement**\n${key.split(':').pop()}\n**Completed on**\n${time(new Date(date))}\n`;

                        if(counter === 1 || keys.length === 1) {
                            amEmbed = baseEmbed.addField('\u200b', amString, true);
                            amString = ''; counter = 0;
                        } else counter++;
                    }

                    if(!done) amEmbed.setFooter({ text: 'Advancement not unlocked/completed.', iconURL: 'https://cdn.discordapp.com/emojis/849215023264169985.png' });
                    else amEmbed.setFooter({ text: 'Advancement completed/unlocked.', iconURL: 'https://cdn.discordapp.com/emojis/849224496232660992.png' });
                }

                console.log(`Sent advancement [${advancementTitle}] of ${username}`);
                message.reply({ embeds: [amEmbed] });
            } catch (err) {
                console.log('Error reading advancementJSON: ', err);
                message.reply(`:warning: Advancement [**${advancementTitle}**] not completed/unlocked or misspelled!`);
            }
        })
    }
}