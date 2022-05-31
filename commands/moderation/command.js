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

        //Suggestion key: arg2=string => 2nd option === string
        //Suggestion key: string => previous option === string
        //Suggestion key: any => any previous option
        let filteredKey = Object.keys(suggestions).find(sug => {
            const splitSug = sug.split("=");
            const index = parseInt(splitSug[0].replace('arg', ''));

            return sug === previousArgument || !isNaN(index) ? splitSug[1] === allOptions?.[index]?.value : false;
        });


        const filteredSuggestions = suggestions?.[filteredKey] ?? suggestions?.['any'];
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
                    const placeholder = await getPlaceholder(replaced.replaceAll('%', ''));
                    if(!placeholder) {
                        console.log(keys.commands.command.warnings.could_not_find_placeholders.console, { placeholder: replaced });
                        continue;
                    }

                    placeholders[replaced.replaceAll('%', '')] = placeholder; //Add Placeholder
                }

                formattedSuggestions.push(replaced);
            }

            const suggestionsObject = addPh(formattedSuggestions, placeholders);
            for([k, v] of Object.entries(suggestionsObject)) {
                if(k.includes(focused.value) || v.includes(focused.value)) respondArray.push({ name: k, value: v });
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

    message.respond(keys.commands.command.success, { "response": resp.message });
}


async function getPlaceholder(key, arguments) {
    const fakeMessage = { respond: () => {} };

    //TODO add placeholders
    let placeholder;
    switch (key) {
        case 'username':
            placeholder = await utils.getUsername(arguments.username, fakeMessage);
            break;

        case 'online_players':
            placeholder = ["TheAnnoying", "ReeceTD", "CommandGeek"];
            break;

        case 'advancements':
            const advancements = await utils.searchAllAdvancements(arguments.searchString ?? '', true, true);
            //Combine to one object and map to name and category.value
            placeholder = Object.assign(...advancements.map(advancement => {
                return { [advancement.name]: `${advancement.category}.${advancement.value}` };
            }));
            break;

        case 'target_selectors':
            //TODO Replace @s with username for the value
            placeholder = ["@a", "@p", "@s", "@r", "@e"];
            break;

        case 'player_coordinates':
            placeholder = { "~ ~ ~": "0 0 0" };
            break;
    }

    return placeholder;
}


module.exports = { execute, autocomplete };
