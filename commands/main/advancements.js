const fs = require('fs');
const Discord = require('discord.js');
const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');
const { time } = require('@discordjs/builders');
const { keys, ph, addPh, getEmbedBuilder} = require('../../api/messages');

async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    const matchingTitles = await utils.searchAdvancements(focused, subcommand);

    const respondArray = [];
    matchingTitles.forEach(title => {
        respondArray.push({
            name: title.name,
            value: title.value
        })
    });

    interaction.respond(respondArray).catch(err => console.log(keys.commands.advancements.errors.could_not_autocomplete, err));
}

async function execute(message, args) {
    const username = message.mentions.users.first()?.tag ?? args[0];
    args.shift();
    const category = args.shift()?.toLowerCase();
    let advancement = args.join(' ')?.toLowerCase();

    if(!username) {
        message.respond(keys.commands.advancements.warnings.no_username);
        return;
    } else if(!category) {
        message.respond(keys.commands.advancements.warnings.no_category);
        return;
    } else if(!advancement) {
        message.respond(keys.commands.advancements.warnings.no_advancement);
        return;
    }

    //Define argument placeholders
    let placeholders = { "advancement_category": category, "advancement_name": advancement, "username": username };

    const matchingAdvancement = await utils.searchAdvancements(advancement, category, true, 1);
    advancement = matchingAdvancement.shift()?.value ?? advancement;

    //Get Advancement Title and Description from lang file
    let advancementTitle;
    let advancementDesc;
    try {
        const langData = JSON.parse(await fs.promises.readFile('./resources/languages/test.json', 'utf-8'));
        advancementTitle = langData[`advancements.${category}.${advancement}.title`];
        advancementDesc = langData[`advancements.${category}.${advancement}.description`];
    } catch(ignored) {}

    if(!advancementTitle) advancementTitle = addPh(keys.commands.advancements.no_title_available, placeholders);
    else if(!advancementDesc) advancementDesc = keys.commands.advancements.no_description_available;

    //Add amTitle and desc to placeholders
    placeholders = Object.assign(placeholders, { "advancement_title": advancementTitle, "advancement_description": advancementDesc });

    if(await settings.isDisabled(message.guildId, 'advancements', category)) {
        message.respond(keys.commands.advancements.warnings.advancement_disabled, placeholders);
        return;
    }
    if(await settings.isDisabled(message.guildId, 'advancements', advancement)) {
        message.respond(keys.commands.advancements.warnings.category_disabled, placeholders);
        return;
    }

    const uuidv4 = await utils.getUUIDv4(username, message.mentions.users.first()?.id, message);
    if(!uuidv4) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const amFile = await ftp.get(`${worldPath}/advancements/${uuidv4}.json`, `./userdata/advancements/${uuidv4}.json`, message);
    if(!amFile) return;

    fs.readFile(`./userdata/advancements/${uuidv4}.json`, 'utf8', async (err, advancementJson) => {
        if(err) {
            message.respond(keys.commands.advancements.errors.could_not_read_file, { "error": err });
            return;
        }

        const advancementData = JSON.parse(advancementJson);

        const letters = advancementTitle.split('');
        let equals = '';
        for(const {} of letters) equals += '=';

        const baseEmbed = getEmbedBuilder(
            keys.commands.advancements.success.base,
            ph.fromStd(message), placeholders, { equals }
        );

        try {
            let amEmbed;
            if(category === 'recipes') {
                const allAdvancements = Object.keys(advancementData);
                const filteredAdvancement = allAdvancements.find(key => key.includes(`recipes/`) && key.endsWith(`/${advancement}`));

                const criteria = Object.keys(advancementData[filteredAdvancement]['criteria']).join('');
                const date = advancementData[filteredAdvancement]['criteria'][criteria];
                const done = advancementData[filteredAdvancement]['done'];

                amEmbed = baseEmbed.addField(
                    keys.commands.advancements.success.final.fields.requirement.title,
                    addPh(keys.commands.advancements.success.final.fields.requirement.content, { "advancement_requirement": criteria.split(':').pop() })
                ).addField(
                    keys.commands.advancements.success.final.fields.unlocked.title,
                    addPh(keys.commands.advancements.success.final.fields.unlocked.content, { "advancement_timestamp": time(new Date(date)) })
                );

                if(!done) amEmbed.setFooter({ text: keys.commands.advancements.success.not_done.footer.text, iconURL: keys.commands.advancements.success.not_done.footer.icon_url });
                else amEmbed.setFooter({ text: keys.commands.advancements.success.done.footer.text, iconURL: keys.commands.advancements.success.done.footer.icon_url });
            } else {
                const allAdvancements = Object.keys(advancementData);
                const filteredAdvancement = allAdvancements.find(key => key.includes(category) && key.endsWith(advancement));

                const criteriaKeys = Object.keys(advancementData[filteredAdvancement]['criteria']);
                const done = advancementData[filteredAdvancement]['done'];

                let counter = 0;
                let amString = '';
                for (const criteria of criteriaKeys) {
                    const date = advancementData[filteredAdvancement]['criteria'][criteria];
                    amString +=
                        `\n${keys.commands.advancements.success.final.fields.requirement.title}
                        ${addPh(keys.commands.advancements.success.final.fields.requirement.content, { "advancement_requirement": criteria.split(':').pop() })}
                        
                        ${keys.commands.advancements.success.final.fields.unlocked.title}
                        ${addPh(keys.commands.advancements.success.final.fields.unlocked.title, { "advancement_timestamp": time(new Date(date)) })}`;

                    //Add one field for every 2 criteria
                    if(counter === 1 || criteriaKeys.length === 1) {
                        amEmbed = baseEmbed.addField('\u200b', amString, true);
                        amString = ''; counter = 0;
                    } else counter++;
                }

                if(!done) amEmbed.setFooter({ text: keys.commands.advancements.success.not_done.footer.text, iconURL: keys.commands.advancements.success.not_done.footer.icon_url });
                else amEmbed.setFooter({ text: keys.commands.advancements.success.done.footer.text, iconURL: keys.commands.advancements.success.done.footer.icon_url });
            }

            console.log(addPh(keys.commands.advancements.success.final.console, placeholders));
            message.reply({ embeds: [amEmbed] });
        } catch (err) {
            message.respond(keys.commands.advancements.warnings.not_completed, placeholders);
        }
    })
}

module.exports = { execute, autocomplete };