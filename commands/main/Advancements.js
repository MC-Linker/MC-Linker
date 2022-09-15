const utils = require('../../api/utils');
const mcData = require('minecraft-data')('1.19.2');
const { time } = require('discord.js');
const { keys, ph, addPh, getEmbed } = require('../../api/messages');
const AutocompleteCommand = require('../../structures/AutocompleteCommand');
const Protocol = require('../../structures/Protocol');

class Advancements extends AutocompleteCommand {

    constructor() {
        super('advancements');
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

    async execute(interaction, client, args) {
        let advancement = args[0].toLowerCase();
        const uuid = await client.userConnections.uuidFromArgument(args[1]);
        const server = client.serverConnections.cache.get(interaction.guildId);

        if(!server) {
            return interaction.replyTl(keys.api.connections.server_not_connected);
        }
        else if(!advancement) {
            return interaction.replyTl(keys.commands.advancements.warnings.no_advancement);
        }
        else if(uuid.error === 'nullish') {
            return interaction.replyTl(keys.commands.advancements.warnings.no_username);
        }
        else if(uuid.error === 'cache') {
            return interaction.replyTl(keys.api.connections.user_not_connected);
        }
        else if(uuid.error === 'fetch') {
            return interaction.replyTl(keys.api.utils.errors.could_not_fetch_uuid);
        }

        let matchingAdvancement;
        if(advancement.includes('.')) {
            //Allows for category.advancement (i.e. nether.root)
            const [category, id] = advancement.split('.');
            matchingAdvancement = await utils.searchAdvancements(id, category, false, true, 1);
        }
        else matchingAdvancement = await utils.searchAllAdvancements(advancement, true, true, 1);
        matchingAdvancement = matchingAdvancement.shift();

        advancement = matchingAdvancement?.value ?? advancement;
        const category = matchingAdvancement?.category;
        const advancementTitle = matchingAdvancement?.name ?? advancement;
        const advancementDesc = matchingAdvancement?.description ?? keys.commands.advancements.no_description_available;

        if(server?.settings?.isDisabled('advancements', advancement)) {
            return interaction.replyTl(
                keys.commands.advancements.warnings.advancement_disabled,
                { 'advancement_title': advancementTitle },
            );
        }

        const amFile = await server.protocol.get(Protocol.FilePath.Advancements(server.path, uuid.uuid), `./userdata/advancements/${uuid.uuid}.json`);
        if(!amFile) return;
        const advancementData = JSON.parse(amFile);

        const letters = [...advancementTitle];
        let equals = '';
        for(const {} of letters) equals += '=';

        const baseEmbed = getEmbed(
            keys.commands.advancements.success.base,
            ph.std(interaction), {
                equals,
                'username': uuid.username ?? uuid,
                'advancement_title': advancementTitle,
                'advancement_description': advancementDesc,
            },
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
                    { 'advancement_requirement': criteria.split(':').pop(), 'advancement_timestamp': time(new Date(date)) },
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
                'username': uuid.username ?? uuid,
            }));
            interaction.replyOptions({ embeds: [amEmbed] });
        }
        catch(err) {
            interaction.replyTl(keys.commands.advancements.warnings.not_completed, { 'advancement_title': advancementTitle });
        }
    }
}

module.exports = Advancements;