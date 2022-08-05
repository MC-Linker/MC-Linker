const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');
const mcData = require('minecraft-data')('1.19');
const { time } = require('discord.js');
const { keys, ph, addPh, getEmbed } = require('../../api/messages');

async function autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();

    const matchingTitles = await utils.searchAllAdvancements(focused);

    const respondArray = [];
    matchingTitles.forEach(title => {
        respondArray.push({
            name: title.name,
            value: `${title.category}.${title.value}`
        })
    });

    interaction.respond(respondArray).catch(() => console.log(keys.commands.advancements.errors.could_not_autocomplete.console));
}

async function execute(message, args) {
    let advancement = args[0].toLowerCase();
    const user = message.mentions.users.first() ?? args[1];

    if(!advancement) {
        message.respond(keys.commands.advancements.warnings.no_advancement);
        return;
    } else if(!user) {
        message.respond(keys.commands.advancements.warnings.no_username);
        return;
    }

    let matchingAdvancement;
    if(advancement.includes('.')) {
        //Allows for category.advancement (i.e. nether.root)
        const [category, id] = advancement.split('.');
        matchingAdvancement = await utils.searchAdvancements(id, category, false, true, 1);
    } else matchingAdvancement = await utils.searchAllAdvancements(advancement, true, true, 1);
    matchingAdvancement = matchingAdvancement.shift();

    advancement = matchingAdvancement?.value ?? advancement;
    const category = matchingAdvancement?.category;
    const advancementTitle = matchingAdvancement?.name ?? advancement;
    const advancementDesc = matchingAdvancement?.description ?? keys.commands.advancements.no_description_available;

    if(await settings.isDisabled(message.guildId, 'advancements', advancement)) {
        message.respond(
            keys.commands.advancements.warnings.advancement_disabled,
            { "advancement_title": advancementTitle }
        );
        return;
    }

    const uuid = await utils.getUUID(user, message.guildId, message);
    if(!uuid) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const amFile = await ftp.get(`${worldPath}/advancements/${uuid}.json`, `./userdata/advancements/${uuid}.json`, message.guildId, message);
    if(!amFile) return;
    const advancementData = JSON.parse(amFile);

    const letters = [...advancementTitle];
    let equals = '';
    for(const {} of letters) equals += '=';

    const baseEmbed = getEmbed(
        keys.commands.advancements.success.base,
        ph.std(message), { equals, "username": user.username ?? user, "advancement_title": advancementTitle, "advancement_description": advancementDesc }
    );

    try {
        let amEmbed;
        if(category === 'recipes') {
            const allAdvancements = Object.keys(advancementData);
            const filteredAdvancement = allAdvancements.find(key => key.includes(`recipes/`) && key.endsWith(`/${advancement}`));

            const criteria = Object.keys(advancementData[filteredAdvancement]['criteria']).join('');
            const date = advancementData[filteredAdvancement]['criteria'][criteria];
            const done = advancementData[filteredAdvancement]['done'];

            amEmbed = baseEmbed.addFields(addPh(
                keys.commands.advancements.success.final.embeds[0].fields,
                { "advancement_requirement": criteria.split(':').pop(), "advancement_timestamp": time(new Date(date)) }
            ));

            if(!done) amEmbed.setFooter(keys.commands.advancements.success.not_done.embeds[0].footer);
            else amEmbed.setFooter(keys.commands.advancements.success.done.embeds[0].footer);
        } else {
            const allAdvancements = Object.keys(advancementData);
            //Filter either by category + id or just id
            const filteredAdvancement = category ?
                allAdvancements.find(key => key.split(':').pop() === `${category}/${advancement}`) :
                allAdvancements.find(key => key.endsWith(advancement));

            const criteriaKeys = Object.keys(advancementData[filteredAdvancement]['criteria']);
            const done = advancementData[filteredAdvancement]['done'];

            let counter = 1;
            let amString = '';
            for(const criteria of criteriaKeys) {
                const date = advancementData[filteredAdvancement]['criteria'][criteria];

                let formattedCriteria = criteria.split(':').pop();
                formattedCriteria = mcData.itemsByName[formattedCriteria]?.displayName ?? formattedCriteria;

                amString +=
                    `\n${keys.commands.advancements.success.final.embeds[0].fields[0].name}
                    ${addPh(keys.commands.advancements.success.final.embeds[0].fields[0].value, 
                    { "advancement_requirement": formattedCriteria })}
                    
                    ${keys.commands.advancements.success.final.embeds[0].fields[1].name}
                    ${addPh(keys.commands.advancements.success.final.embeds[0].fields[1].value, 
                    { "advancement_timestamp": time(new Date(date)) })}`;

                //Add one field for every 2 criteria
                if(counter % 2 || criteriaKeys.length === 1) {
                    amEmbed = baseEmbed.addFields({ name: '\u200b', value: amString, inline: true });
                    amString = '';
                }

                counter++;
            }

            if(!done) amEmbed.setFooter(keys.commands.advancements.success.not_done.embeds[0].footer);
            else amEmbed.setFooter(keys.commands.advancements.success.done.embeds[0].footer);
        }

        console.log(addPh(keys.commands.advancements.success.final.console, { "advancement_title": advancementTitle, "username": user.username ?? user }));
        message.replyOptions({ embeds: [amEmbed] });
    } catch (err) {
        message.respond(keys.commands.advancements.warnings.not_completed, { "advancement_title": advancementTitle });
    }
}

module.exports = { execute, autocomplete };