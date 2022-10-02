const utils = require('../../api/utils');
const mcData = require('minecraft-data')('1.19.2');
const { time } = require('discord.js');
const { keys, ph, addPh, getEmbed } = require('../../api/messages');
const AutocompleteCommand = require('../../structures/AutocompleteCommand');
const Protocol = require('../../structures/Protocol');

class Advancements extends AutocompleteCommand {

    constructor() {
        super({
            name: 'advancements',
            requiresConnectedUser: 1,
        });
    }

    async autocomplete(interaction, client) {
        const focused = interaction.options.getFocused().toLowerCase();

        const matchingTitles = await utils.searchAllAdvancements(focused);

        const respondArray = [];
        matchingTitles.forEach(title => {
            respondArray.push({
                name: title.name,
                value: `${title.category}.${title.value}`,
            });
        });

        interaction.respond(respondArray)
            .catch(() => console.log(keys.commands.advancements.errors.could_not_autocomplete.console));
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        let advancement = args[0].toLowerCase();
        const user = args[1];

        let matchingAdvancement;
        if(advancement.includes('.')) {
            //Allows for category.advancement (i.e. nether.root)
            const [category, id] = advancement.split('.');
            matchingAdvancement = utils.searchAdvancements(id, category, false, true, 1);
        }
        else matchingAdvancement = utils.searchAllAdvancements(advancement, true, true, 1);
        matchingAdvancement = matchingAdvancement.shift();

        advancement = matchingAdvancement?.value ?? advancement;
        const category = matchingAdvancement?.category;
        const advancementTitle = matchingAdvancement?.name ?? advancement;
        const advancementDesc = matchingAdvancement?.description ?? keys.commands.advancements.no_description_available;

        if(server.settings.isDisabled('advancements', advancement)) {
            return interaction.replyTl(
                keys.commands.advancements.warnings.advancement_disabled,
                { 'advancement_title': advancementTitle },
            );
        }

        const amFile = await server.protocol.get(Protocol.FilePath.Advancements(server.path, user.uuid), `./userdata/advancements/${user.uuid}.json`);
        if(!amFile) {
            return interaction.replyTl(keys.api.command.errors.could_not_download_user_files, { category: 'advancements' });
        }
        const advancementData = JSON.parse(amFile.toString('utf-8'));

        const letters = [...advancementTitle];
        let equals = '';
        for(const {} of letters) equals += '=';

        const baseEmbed = getEmbed(
            keys.commands.advancements.success.base,
            ph.std(interaction), {
                equals,
                'username': user.username,
                'advancement_title': advancementTitle,
                'advancement_description': advancementDesc,
            },
        );
        if(!baseEmbed) return interaction.replyTl(keys.main.errors.could_not_execute_command);

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
                    {
                        'advancement_requirement': criteria.split(':').pop(),
                        'advancement_timestamp': time(new Date(date)),
                    },
                ));

                if(!done) amEmbed.setFooter(keys.commands.advancements.success.not_done.embeds[0].footer);
                else amEmbed.setFooter(keys.commands.advancements.success.done.embeds[0].footer);
            }
            else {
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
                            { 'advancement_requirement': formattedCriteria })}
                    
                    ${keys.commands.advancements.success.final.embeds[0].fields[1].name}
                    ${addPh(keys.commands.advancements.success.final.embeds[0].fields[1].value,
                            { 'advancement_timestamp': time(new Date(date)) })}`;

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

            console.log(addPh(keys.commands.advancements.success.final.console, {
                'advancement_title': advancementTitle,
                'username': user.username ?? user,
            }));

            await interaction.replyOptions({ embeds: [amEmbed] });
        }
        catch(err) {
            await interaction.replyTl(keys.commands.advancements.warnings.not_completed, { 'advancement_title': advancementTitle });
        }
    }
}

module.exports = Advancements;