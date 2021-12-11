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
                              .addChoice('Minecraft', 'root')
                              .addChoice('Stone Age', 'mine_stone')
                              .addChoice('Getting an Upgrade', 'mine_stone')
                              .addChoice('Acquire Hardware', 'smelt_iron')
                              .addChoice('Suit Up', 'obtain_armor')
                              .addChoice('Hot Stuff', 'lava_bucket')
                              .addChoice('Isn\'t It Iron Pick', 'iron_tools')
                              .addChoice('Not Today, Thank You', 'deflect_arrow')
                              .addChoice('Ice Bucket Challenge', 'form_obsidian')
                              .addChoice('Diamonds!', 'mine_diamond')
                              .addChoice('We Need to Go Deeper', 'enter_the_nether')
                              .addChoice('Cover Me With Diamonds', 'shiny_gear')
                              .addChoice('Enchanter', 'enchant_item')
                              .addChoice('Zombie Doctor', 'cure_zombie_villager')
                              .addChoice('Eye Spy', 'follow_ender_eye')
                              .addChoice('The End?', 'enter_the_end')
                    ).addUserOption(option =>
                        option.setName('user')
                              .setDescription('Set the user you want to get the advancements from.')
                              .setRequired(true)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('nether')
                        .setDescription('Bring summer clothes')
                        .addStringOption(option =>
                            option.setName('advancement')
                                  .setDescription('Set the advancement')
                                  .setRequired(true)
                                  .addChoice('Nether', 'root')
                                  .addChoice('Return to Sender', 'return_to_sender')
                                  .addChoice('Those Were the Days', 'find_bastion')
                                  .addChoice('Hidden in the Depths', 'obtain_ancient_debris')
                                  .addChoice('Subspace Bubble', 'fast_travel')
                                  .addChoice('A Terrible Fortress', 'find_fortress')
                                  .addChoice('Who is Cutting Onions?', 'obtain_crying_obsidian')
                                  .addChoice('Oh Shiny', 'distract_piglin')
                                  .addChoice('This Boat Has Legs', 'ride_strider')
                                  .addChoice('Uneasy Alliance', 'uneasy_alliance')
                                  .addChoice('War Pigs', 'loot_bastion')
                                  .addChoice('Country Lode, Take Me Home', 'use_lodestone')
                                  .addChoice('Cover Me in Debris', 'netherite_armor')
                                  .addChoice('Spooky Scary Skeleton', 'get_wither_skull')
                                  .addChoice('Into Fire', 'obtain_blaze_rod')
                                  .addChoice('Not Quite "Nine" Lives', 'charge_respawn_anchor')
                                  .addChoice('Hot Tourist Destinations', 'explore_nether')
                                  .addChoice('Withering Heights', 'summon_wither')
                                  .addChoice('Local Brewery', 'brew_potion')
                                  .addChoice('Bring Home the Beacon', 'create_beacon')
                                  .addChoice('A Furious Cocktail', 'all_potions')
                                  .addChoice('Beaconator', 'create_full_beacon')
                                  .addChoice('How Did We Get Here?', 'all_effects')
                        ).addUserOption(option =>
                            option.setName('user')
                                  .setDescription('Set the user you want to get the advancements from.')
                                  .setRequired(true)
                        )
            ).addSubcommand(subcommand =>
                subcommand.setName('end')
                    .setDescription('Or the beginning?')
                    .addStringOption(option =>
                        option.setName('advancement')
                              .setDescription('Set the advancement')
                              .setRequired(true)
                              .addChoice('The End?', 'root')
                              .addChoice('Free the End', 'kill_dragon')
                              .addChoice('The Next Generation', 'dragon_egg')
                              .addChoice('Remote Getaway', 'enter_end_gateway')
                              .addChoice('The End... Again...', 'respawn_dragon')
                              .addChoice('You Need a Mint', 'dragon_breath')
                              .addChoice('The City at the End of the Game', 'find_end_city')
                              .addChoice('Sky\'s the Limit', 'elytra')
                              .addChoice('Great View From Up Here', 'levitate')
                    ).addUserOption(option =>
                        option.setName('user')
                              .setDescription('Set the user you want to get the advancements from.')
                              .setRequired(true)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('adventure')
                    .setDescription('Adventure, exploration, and combat')
                    .addStringOption(option =>
                        option.setName('advancement')
                              .setDescription('Set the advancement')
                              .setRequired(true)
                              .addChoice('Adventure', 'root')
                              .addChoice('Voluntary Exile', 'voluntary_exile')
                              .addChoice('Is It a Bird?', 'spyglass_at_parrot')
                              .addChoice('Monster Hunter', 'kill_a_mob')
                              .addChoice('What a Deal!', 'trade')
                              .addChoice('Sticky Situation', 'honey_block_slide')
                              .addChoice('Ol\' Betsy', 'ol_betsy')
                              .addChoice('Surge Protector', 'lightning_rod_with_villager_no_fire')
                              .addChoice('Light as a Rabbit', 'walk_on_powder_snow_with_leather_boots')
                              .addChoice('Sweet Dreams', 'sleep_in_bed')
                              .addChoice('Hero of the Village', 'hero_of_the_village')
                              .addChoice('Is It a Balloon?', 'spyglass_at_ghast')
                              .addChoice('A Throwaway Joke', 'throw_trident')
                              .addChoice('Take Aim', 'shoot_arrow')
                              .addChoice('Monsters Hunted', 'kill_all_mobs')
                              .addChoice('Postmortal', 'totem_of_undying')
                              .addChoice('Hired Help', 'summon_iron_golem')
                              .addChoice('Two Birds, One Arrow', 'two_birds_one_arrow')
                              .addChoice('Who\'s the Pillager Now?', 'whos_the_pillager_now')
                              .addChoice('Arbalistic', 'arbalistic')
                              .addChoice('Adventuring Time', 'adventuring_time')
                              .addChoice('Is It a Plane?', 'spyglass_at_dragon')
                              .addChoice('Very Very Frightening', 'very_very_frightening')
                              .addChoice('Sniper Duel', 'sniper_duel')
                              .addChoice('Bullseye', 'bullseye')
                    ).addUserOption(option =>
                        option.setName('user')
                              .setDescription('Set the user you want to get the advancements from.')
                              .setRequired(true)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('husbandry')
                    .setDescription('The world is full of friends and food')
                    .addStringOption(option =>
                            option.setName('advancement')
                                  .setDescription('Set the advancement')
                                  .setRequired(true)
                                  .addChoice('Husbandry', 'root')
                                  .addChoice('Bee Our Guest', 'safely_harvest_honey')
                                  .addChoice('The Parrots and the Bats', 'breed_an_animal')
                                  .addChoice('Whatever Floats Your Goat!', 'ride_a_boat_with_a_goat')
                                  .addChoice('Best Friends Forever', 'tame_an_animal')
                                  .addChoice('Glow and Behold!', 'make_a_sign_glow')
                                  .addChoice('Fishy Business', 'fishy_business')
                                  .addChoice('Total Beelocation', 'silk_touch_nest')
                                  .addChoice('A Seedy Place', 'plant_seed')
                                  .addChoice('Wax On', 'wax_on')
                                  .addChoice('Two by Two', 'bred_all_animals')
                                  .addChoice('A Complete Catalogue', 'complete_catalogue')
                                  .addChoice('Tactical Fishing', 'tactical_fishing')
                                  .addChoice('A Balanced Diet', 'balanced_diet')
                                  .addChoice('Serious Dedication', 'obtain_netherite_hoe')
                                  .addChoice('Wax Off', 'wax_off')
                                  .addChoice('The Cutest Predator', 'axolotl_in_a_bucket')
                                  .addChoice('The Healing Power of Friendship!', 'kill_axolotl_target')
                    ).addUserOption(option =>
                        option.setName('user')
                              .setDescription('Set the user you want to get the advancements from.')
                              .setRequired(true)
                    )
            ),
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

        //Get Title from slash command choices
        const advancementTitles = this.data.toJSON().options.filter(option => option.name.toLowerCase() === category).shift()?.options.shift().choices;
        const advancementId = advancementTitles?.filter(title => title.name.toLowerCase() === advancement).shift()?.value;
        advancement = advancementId ?? advancement;

        const uuidv4 = await utils.getUUIDv4(username, message.mentions.users.first()?.id, message);
        if(!uuidv4) return;

        console.log(`${message.member.user.tag} executed /advancements ${username} ${category} ${advancement} in ${message.guild.name}`);

        const categoryDisabled = fs.existsSync(`./disable/advancements/${message.guild.id}_${category}`);
        if(categoryDisabled === true) {
            console.log(`Advancement category [${category}] disabled.`);
            message.reply(`:no_entry: Advancement category [**${category}**] disabled!`);
            return;
        }
        const advancementDisabled = fs.existsSync(`./disable/advancements/${message.guild.id}_${advancement}`);
        if(advancementDisabled === true) {
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
                    const allKeys = Object.keys(advancementData);
                    const filteredKey = allKeys.filter(key => key.startsWith(`minecraft:${category}/`) && key.endsWith(`/${advancement}`)).shift();

                    const criteria = Object.keys(advancementData[filteredKey]['criteria']).join('');
                    const date = advancementData[filteredKey]['criteria'][criteria];
                    const done = advancementData[filteredKey]['done'];

                    amEmbed = baseEmbed.addField('Criteria', criteria).addField('unlocked on', time(new Date(date)));

                    if(done && done === false) amEmbed.setFooter('Advancement not unlocked/completed.', 'https://cdn.discordapp.com/emojis/849215023264169985.png');
                    else amEmbed.setFooter('Advancement completed/unlocked.', 'https://cdn.discordapp.com/emojis/849224496232660992.png');
                } else {
                    const keys = Object.keys(advancementData[`minecraft:${category}/${advancement}`]['criteria']);
                    const done = advancementData[`minecraft:${category}/${advancement}`]['done'];

                    let counter = 0;
                    let amString = '';
                    for (const key of keys) {
                        const date = advancementData[`minecraft:${category}/${advancement}`]['criteria'][key];
                        amString += `\n**Criteria**\n${key.replace('minecraft:', '')}\n**Completed on**\n${time(new Date(date))}\n`;

                        if(counter === 1 || keys.length === 1) {
                            amEmbed = baseEmbed.addField('\u200b', amString, true);
                            amString = ''; counter = 0;
                        } else counter++;
                    }

                    if(done === false) amEmbed.setFooter('Advancement not unlocked/completed.', 'https://cdn.discordapp.com/emojis/849215023264169985.png');
                    else amEmbed.setFooter('Advancement completed/unlocked.', 'https://cdn.discordapp.com/emojis/849224496232660992.png');
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