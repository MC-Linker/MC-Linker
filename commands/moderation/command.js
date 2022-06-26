const { keys, getUsersFromMention, addPh } = require('../../api/messages');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const mcData = require('minecraft-data')('1.19');
const commands = require('../../resources/data/commands.json');


async function autocomplete(interaction) {
    //TODO Add some super fancy autocomplete for target selectors
    const respondArray = [];
    const focused = interaction.options.getFocused(true);

    if(focused.name === 'command') {
        Object.keys(commands).forEach(cmd => {
            if(cmd.includes(focused.value)) respondArray.push({ name: cmd, value: cmd });
        });
    } else {
        const allOptions = [...interaction.options.data];
        const commandName = allOptions[0].value.toLowerCase();
        allOptions.shift(); //Shift command name

        const placeholders = {};

        const cmdKey = Object.keys(commands).find(cmd => cmd === commandName);
        const focusedIndex = allOptions.findIndex(opt => opt.name === focused.name);

        const allSuggestions = commands[cmdKey];
        if(!allSuggestions) return;
        const suggestions = allSuggestions[focusedIndex];
        if(!suggestions) return;

        const previousArgument = allOptions?.[focusedIndex-1]?.value;

        let filteredKey = findSuggestionKey(suggestions, previousArgument, allOptions);

        const filteredSuggestions = suggestions?.[filteredKey] ?? suggestions?.[''];
        if(filteredSuggestions) {
            const formattedSuggestions = [];
            for (const sug of filteredSuggestions) {
                //Run logic for each placeholder and add properties to ph object
                await addPlaceholders(sug);
            }

            async function addPlaceholders(suggestion) {
                if(suggestion.match(/%.+%/g)) {
                    //Replace arg[0-9] with corresponding value for placeholders
                    //arg2 => value of 2nd option
                    suggestion = suggestion.replace(/%arg(-?\d)_.+%/g, (match, index) => {
                        index = parseInt(index);

                        if(index < 0) index = allOptions.length + index-1; //Allow relative (negative) indexes
                        return allOptions?.[index]?.value ? match.replace(/arg-?\d/, allOptions?.[index]?.value) : match;
                    });

                    let filteredArguments;
                    if(suggestion.includes('_argument_')) {
                        const [command, index] = suggestion.split(/%(.+)_argument_(\d)%/).filter(n => n);
                        const commandSuggestions = commands[command]?.[parseInt(index)];

                        if(commandSuggestions) {
                            const filteredCommandKey = findSuggestionKey(commandSuggestions, previousArgument, allOptions);

                            filteredArguments = commandSuggestions[filteredCommandKey] ?? commandSuggestions[''];
                        }
                    }

                    const placeholder = await getPlaceholder(
                        suggestion.replaceAll('%', ''),
                        { user: interaction.user.id, guild: interaction.guildId, focused: focused.value, commands: Object.keys(commands), commandSuggestions: filteredArguments }
                    );
                    if(!placeholder) {
                        console.log(addPh(keys.commands.command.warnings.could_not_find_placeholders.console, { placeholder: suggestion }));
                        return;
                    }

                    if(filteredArguments) {
                        for(const argument of filteredArguments) await addPlaceholders(argument);
                    }
                    //Add Placeholder
                    placeholders[suggestion.replaceAll('%', '')] = placeholder;
                }

                formattedSuggestions.push(suggestion);
            }

            const suggestionsObject = addPh(formattedSuggestions, placeholders);
            for([k, v] of Object.entries(suggestionsObject)) {
                if(k?.includes(focused.value.toLowerCase()) || v?.includes(focused.value.toLowerCase())) respondArray.push({ name: k, value: v });
            }
        } else return;
    }

    if(respondArray.length >= 25) respondArray.length = 25;
    interaction.respond(respondArray);
}

//Suggestion key:
//"arg2=string" => 2nd option === string
//"string" => previous option === string
//"arg-1!=string" => previous option !== string
//"arg2=string & arg1=string2" => 2nd option === string && 1st option === string2
//"" => any previous option
function findSuggestionKey(suggestions, previousArgument, allOptions) {
    return Object.keys(suggestions).find(suggestion => {
        suggestion = suggestion.replaceAll(' ', ''); //Remove all whitespaces

        let returnBool = true;
        suggestion.split('&').forEach(condition => {
            if (!returnBool) return;
            let [index, string] = condition.split("=", 2);

            index = parseInt(index.replace('arg', ''));
            if (index < 0) index = allOptions?.length + index-1; //Allow relative (negative) indexes

            returnBool = condition === previousArgument || (!isNaN(index) ? string === allOptions?.[index]?.value : false);
        });

        return returnBool;
    });
}


async function execute(message, args) {
    const command = args[0];
    args.shift(); //Shift commandName

    if (!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        message.respond(keys.commands.command.warnings.no_permission);
        return;
    } else if(!command) {
        message.respond(keys.commands.command.warnings.no_command);
        return;
    }

    //Replace pings and @s with corresponding username
    //TODO replace ~ ~ ~ with player coordinates
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        let user;
        if(arg === "@s") user = message.member.user;
        else user = getUsersFromMention(message.client, arg)?.[0];
        if(!user) continue;

        const username = await utils.getUsername(user.id, message);
        if(!username) return;

        args[i] = arg.replace(arg, username);
    }

    const resp = await plugin.execute(`${command} ${args.join(' ')}`, message);
    if(!resp) return;

    let respMessage = resp.status === 200 ? resp.json.message : keys.api.plugin.warnings.no_response_message;

    //Either '+' or '-' depending on color code
    let colorChar = '';
    if(resp.json.color === 'c' || resp.status !== 200) colorChar = '- ';
    else if(resp.json.color === 'a') colorChar = '+ ';

    //Wrap in discord code block for color
    respMessage = `\`\`\`diff\n${colorChar}${respMessage}\`\`\``;

    message.respond(keys.commands.command.success, { "response": respMessage });
}

async function getPlaceholder(key, arguments) {
    const fakeMessage = { respond: () => {} };

    //TODO add placeholders
    let placeholder;
    switch (key) {
        case 'advancements':
            const advancements = await utils.searchAllAdvancements(arguments.focused ?? '', true, true);
            //Combine to one object and map to name and category.value
            placeholder = Object.assign(...advancements.map(advancement => {
                return { [advancement.name]: `minecraft:${advancement.category}/${advancement.value}` };
            }));
            break;
        case 'target_selectors':
            //TODO get online players
            const onlinePlayers = ["TheAnnoying", "ReeceTD", "CommandGeek"];

            const username = await utils.getUsername(arguments.user, fakeMessage);

            placeholder = {
                "@a": "@a",
                "@p": "@p",
                "@r": "@r",
                "@e": "@e",
            };

            if(onlinePlayers) onlinePlayers.forEach(player => placeholder[player] = player);
            if(username) {
                placeholder["@s"] = username;
                placeholder[username] = username;
            }
            break;
        case 'attributes':
            const attributes = mcData.attributesArray;

            placeholder = Object.assign(...attributes.map(attribute => {
                return { [attribute.name]: attribute.resource };
            }));
            break;
        case 'datapacks':
             break;
        case 'functions':
            break;
        case 'player_coordinates':
            //TODO get coordinates
            placeholder = ['~ ~ ~'];
            break;
        case 'player_coordinates_xz':
            placeholder = ['~ ~'];
            break;
        case 'items':
            const items = mcData.itemsArray;

            placeholder = Object.assign(...items.map(item => {
                return { [item.displayName]: item.name };
            }));
            break;
        case 'blocks':
            const blocks = mcData.blocksArray;

            placeholder = Object.assign(...blocks.map(block => {
                return { [block.displayName]: block.name };
            }));
            break;
        case 'block_tags':
            break;
        case 'structure_tags':
            break;
        case 'item_tags':
            break;
        case 'biome_tags':
            break;
        case 'structures':
            break;
        case 'effects':
            break;
        case 'enchantments':
            break;
        case 'scoreboards':
            break;
        case 'bossbars':
            break;
        case 'commands':
            placeholder = arguments.commands;
            break;
        case 'slots':
            const slots = [
                'armor.chest',
                'armor.feet',
                'armor.head',
                'armor.legs',
                'weapon',
                'weapon.mainhand',
                'weapon.offhand',
                'horse.saddle',
                'horse.chest',
                'horse.armor',
            ];

            //Push extra slots
            for (let i = 0; i < 54; i++) {
                if(i >= 0 && i <= 7) slots.push(`villager.${i}`);
                if(i >= 0 && i <= 8) slots.push(`hotbar.${i}`);
                if(i >= 0 && i <= 14) slots.push(`horse.${i}`);
                if(i >= 0 && i <= 26) slots.push(`inventory.${i}`);
                if(i >= 0 && i <= 26) slots.push(`enderchest.${i}`);
                if(i >= 0 && i <= 53) slots.push(`container.${i}`);
            }

            placeholder = slots;
            break;
        case 'loot':
            const blockLoot = mcData.blockLoot;
            const entityLoot = mcData.entityLoot;

            placeholder = Object.assign(
                ...Object.values(blockLoot).map(loot => {
                    return { [mcData.blocksByName[loot.block].displayName]: `blocks/${loot.block}` };
                }),
                ...Object.values(entityLoot).map(loot => {
                    return { [mcData.entitiesByName[loot.entity].displayName]: `entities/${loot.entity}` };
                }),
                ...[
                    'abandoned_mineshaft',
                    'bastion_bridge',
                    'bastion_hoglin_stable',
                    'bastion_other',
                    'bastion_treasure',
                    'buried_treasure',
                    'desert_pyramid',
                    'end_city_treasure',
                    'igloo_chest',
                    'jungle_temple',
                    'jungle_temple_dispenser',
                    'nether_bridge',
                    'pillager_outpost',
                    'ruined_portal',
                    'shipwreck_map',
                    'shipwreck_supply',
                    'shipwreck_treasure',
                    'simple_dungeon',
                    'spawn_bonus_chest',
                    'stronghold_corridor',
                    'stronghold_crossing',
                    'stronghold_library',
                    'underwater_ruin_big',
                    'underwater_ruin_small',
                    'woodland_mansion',
                    'village/village_armorer',
                    'village/village_butcher',
                    'village/village_cartographer',
                    'village/village_mason',
                    'village/village_shepherd',
                    'village/village_tannery',
                    'village/village_weaponsmith',
                    'village/village_desert_house',
                    'village/village_plains_house',
                    'village/village_savanna_house',
                    'village/village_snowy_house',
                    'village/village_taiga_house',
                    'village/village_fisher',
                    'village/village_fletcher',
                    'village/village_temple',
                    'village/village_toolsmith',
                ].map(loot => {
                    const formattedLoot = loot.split('/').pop().split('_').map(word => word.cap()).join(' ');
                    return {
                        [formattedLoot]: `chests/${loot}`
                    };
                }),
                ...[
                    'cat_morning_gift',
                    'fishing/fish',
                    'fishing/junk',
                    'fishing/treasure',
                    'fishing',
                    'hero_of_the_village/armorer_gift',
                    'hero_of_the_village/butcher_gift',
                    'hero_of_the_village/cartographer_gift',
                    'hero_of_the_village/cleric_gift',
                    'hero_of_the_village/farmer_gift',
                    'hero_of_the_village/fisherman_gift',
                    'hero_of_the_village/fletcher_gift',
                    'hero_of_the_village/leatherworker_gift',
                    'hero_of_the_village/librarian_gift',
                    'hero_of_the_village/mason_gift',
                    'hero_of_the_village/shepherd_gift',
                    'hero_of_the_village/toolsmith_gift',
                    'hero_of_the_village/weaponsmith_gift',
                    'piglin_bartering',
                ].map(loot => {
                    const formattedLoot = loot.split('/').pop().split('_').map(word => word.cap()).join(' ');
                    return {
                        [formattedLoot]: `gameplay/${loot}`
                    }
                })
            );
            break;
        case 'sounds':
            break;
        case 'recipes':
            break;
        case 'scoreboard_displays':
            break;
        case 'scoreboard_criteria':
            break;
        case 'entities':
            break;
        case 'teams':
            break;
        case 'pois':
            placeholder = [
                'armorer',
                'bee_nest',
                'beehive',
                'butcher',
                'cartographer',
                'cleric',
                'farmer',
                'fisherman',
                'fletcher',
                'home',
                'leatherworker',
                'librarian',
                'lightning_rod',
                'lodestone',
                'mason',
                'meeting',
                'nether_portal',
                'shepherd',
                'toolsmith',
                'weaponsmith'
            ];
            break;
        case 'poi_tags':
            placeholder = [
                '#acquirable_job_site',
                '#bee_home',
                '#village'
            ];
            break;
        case 'jigsaws':
            break;
        case 'templates':
            break;
        case 'features':
            break;
        case 'colors':
            placeholder = [
                "reset",
                "black",
                "dark_blue",
                "dark_green",
                "dark_aqua",
                "dark_red",
                "dark_purple",
                "gold",
                "gray",
                "dark_gray",
                "blue",
                "green",
                "aqua",
                "red",
                "light_purple",
                "yellow",
                "white",
            ];
            break;
        case key.includes('_argument_') ? key : null:
            placeholder = arguments.commandSuggestions;
            break;
        case key.endsWith('_criteria') ? key : null:
            break;
        case key.endsWith('_levels') ? key : null:
            break;
    }

    return placeholder;
}


module.exports = { execute, autocomplete };
