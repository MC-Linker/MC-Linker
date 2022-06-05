const { keys, getUsersFromMention, addPh} = require('../../api/messages');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const commands = require('../../resources/data/commands.json');


async function autocomplete(interaction) {
    //TODO Add some super fancy autocomplete for command name + options
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

        const cmdKey = Object.keys(commands).find(cmd => cmd.includes(commandName));
        const focusedIndex = allOptions.findIndex(opt => opt.name === focused.name);

        const allSuggestions = commands[cmdKey];
        if(!allSuggestions) return;
        const suggestions = allSuggestions[focusedIndex];
        if(!suggestions) return;

        const previousArgument = allOptions?.[focusedIndex-1]?.value;

        //Suggestion key:
        //"arg2=string" => 2nd option === string
        //"string" => previous option === string
        //"arg2=string & arg1=string2" => 2nd option === string && 1st option === string2
        //"" => any previous option
        let filteredKey = Object.keys(suggestions).find(suggestion => {
            suggestion = suggestion.replaceAll(' ', ''); //Remove all whitespaces

            let returnBool = true;

            suggestion.split('&').forEach(condition => {
                if(!returnBool) return;

                let [index, ...string] = condition.split("=");
                index = parseInt(index.replace('arg', ''));

                returnBool = condition === previousArgument || (!isNaN(index) ? string.join('=') === allOptions?.[index]?.value : false);
            });

            return returnBool;
        });

        const filteredSuggestions = suggestions?.[filteredKey] ?? suggestions?.[''];
        if(filteredSuggestions) {
            const formattedSuggestions = [];
            for (const sug of filteredSuggestions) {
                //Replace arg[0-9] with corresponding value for placeholders
                //arg2 => value of 2 options earlier
                const replaced = sug.replace(/%arg(\d)_[a-zA-Z]+%/g, (match, group) =>
                    match.replace(`arg${group}`, allOptions?.[group]?.value ?? `arg${group}`)
                );


                //Run logic for each placeholder and add properties to object
                if(sug.match(/%\w+%/g)) {
                    const placeholder = await getPlaceholder(replaced.replaceAll('%', ''), { user: interaction.user.id, guild: interaction.guildId, focused: focused.value });
                    if(!placeholder) {
                        console.log(addPh(keys.commands.command.warnings.could_not_find_placeholders.console, { placeholder: replaced }));
                        continue;
                    }

                    placeholders[replaced.replaceAll('%', '')] = placeholder; //Add Placeholder
                }

                formattedSuggestions.push(replaced);
            }

            const suggestionsObject = addPh(formattedSuggestions, placeholders);
            for([k, v] of Object.entries(suggestionsObject)) {
                if(k?.includes(focused.value) || v?.includes(focused.value)) respondArray.push({ name: k, value: v });
            }
        } else return;

    }

    if(respondArray.length >= 25) respondArray.length = 25;
    interaction.respond(respondArray);
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

    //Replace pings with corresponding username
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        const user = getUsersFromMention(message.client, arg)?.[0];
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
                return { [advancement.name]: `${advancement.category}.${advancement.value}` };
            }));
            break;

        case 'target_selectors':
            //TODO Replace @s with username for the value
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
            placeholder = [
                "generic.max_health",
                "generic.follow_range",
                "generic.knockback_resistance",
                "generic.movement_speed",
                "generic.attack_damage",
                "generic.armor",
                "generic.armor_toughness",
                "generic.attack_knockback",
                "generic.attack_speed",
                "generic.luck",
                "horse.jump_strength",
                "generic.flying_speed",
                "zombie.spawn_reinforcements",
            ];
            break;

        case 'datapacks':
             break;
        case 'functions':
            break;
        case 'player_coordinates':
            break;
        case 'items':
            break;
        case 'tags':
            break;
        case 'effects':
            break;
        case 'enchantments':
            break;
        case 'scoreboards':
            break;
        case 'bossbars':
            break;
        case key.endsWith('_criteria'):
            break;
        case key.endsWith('_levels'):
            break;
    }

    return placeholder;
}


module.exports = { execute, autocomplete };
