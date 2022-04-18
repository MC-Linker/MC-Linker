const fs = require('fs');
const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');
const { time } = require('@discordjs/builders');
const { keys, ph, addPh, getEmbedBuilder } = require('../../api/messages');

async function autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();

    const matchingTitles = await utils.searchAllAdvancements(focused);

    const respondArray = [];
    matchingTitles.forEach(title => {
        respondArray.push({
            name: title.name,
            value: title.value
        })
    });

    interaction.respond(respondArray).catch(() => console.log(keys.commands.advancements.errors.could_not_autocomplete.console));
}

async function execute(message, args) {
    let advancement = args[0].toLowerCase();
    const user = message.mentions.users.first() ?? args[1];

    if(!user) {
        message.respond(keys.commands.advancements.warnings.no_username);
        return;
    } else if(!advancement) {
        message.respond(keys.commands.advancements.warnings.no_advancement);
        return;
    }

    let matchingAdvancement = await utils.searchAllAdvancements(advancement, true, 1);
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

    const uuidv4 = await utils.getUUIDv4(user, message);
    if(!uuidv4) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const amFile = await ftp.get(`${worldPath}/advancements/${uuidv4}.json`, `./userdata/advancements/${uuidv4}.json`, message);
    if(!amFile) return;

    fs.readFile(`./userdata/advancements/${uuidv4}.json`, 'utf8', async (err, advancementJson) => {
        if(err) {
            message.respond(keys.commands.advancements.errors.could_not_read_file, ph.fromError(err));
            return;
        }

        const advancementData = JSON.parse(advancementJson);

        const letters = advancementTitle.split('');
        let equals = '';
        for(const {} of letters) equals += '=';

        const baseEmbed = getEmbedBuilder(
            keys.commands.advancements.success.base,
            ph.fromStd(message), { equals, "username": user.username ?? user, "advancement_title": advancementTitle, "advancement_description": advancementDesc }
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
                //Filter either by category + id or just id
                const filteredAdvancement = category ?
                    allAdvancements.find(key => key.split(':').pop() === `${category}/${advancement}`) :
                    allAdvancements.find(key => key.endsWith(advancement));

                const criteriaKeys = Object.keys(advancementData[filteredAdvancement]['criteria']);
                const done = advancementData[filteredAdvancement]['done'];

                let counter = 0;
                let amString = '';
                for (const criteria of criteriaKeys) {
                    const date = advancementData[filteredAdvancement]['criteria'][criteria];
                    amString +=
                        `\n**${keys.commands.advancements.success.final.fields.requirement.title}**
                        ${addPh(keys.commands.advancements.success.final.fields.requirement.content, { "advancement_requirement": criteria.split(':').pop() })}
                        
                        **${keys.commands.advancements.success.final.fields.unlocked.title}**
                        ${addPh(keys.commands.advancements.success.final.fields.unlocked.content, { "advancement_timestamp": time(new Date(date)) })}`;

                    //Add one field for every 2 criteria
                    if(counter === 1 || criteriaKeys.length === 1) {
                        amEmbed = baseEmbed.addField('\u200b', amString, true);
                        amString = ''; counter = 0;
                    } else counter++;
                }

                if(!done) amEmbed.setFooter({ text: keys.commands.advancements.success.not_done.footer.text, iconURL: keys.commands.advancements.success.not_done.footer.icon_url });
                else amEmbed.setFooter({ text: keys.commands.advancements.success.done.footer.text, iconURL: keys.commands.advancements.success.done.footer.icon_url });
            }

            console.log(addPh(keys.commands.advancements.success.final.console, { "advancement_title": advancementTitle, "username": user.username ?? user }));
            message.replyOptions({ embeds: [amEmbed] });
        } catch (err) {
            message.respond(keys.commands.advancements.warnings.not_completed, { "advancement_title": advancementTitle });
        }
    })
}

module.exports = { execute, autocomplete };