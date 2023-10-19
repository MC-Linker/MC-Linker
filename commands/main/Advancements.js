import * as utils from '../../utilities/utils.js';
import { getMinecraftAvatarURL } from '../../utilities/utils.js';
import minecraft_data from 'minecraft-data';
import { time } from 'discord.js';
import { ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import AutocompleteCommand from '../../structures/AutocompleteCommand.js';
import { FilePath } from '../../structures/Protocol.js';

const mcData = minecraft_data('1.20.1');

export default class Advancements extends AutocompleteCommand {

    constructor() {
        super({
            name: 'advancements',
            requiresUserIndex: 1,
            category: 'main',
        });
    }

    autocomplete(interaction, client) {
        const focused = interaction.options.getFocused().toLowerCase();

        const matchingTitles = utils.searchAllAdvancements(focused);

        const respondArray = [];
        matchingTitles.forEach(title => {
            respondArray.push({
                name: title.name,
                value: `${title.category}.${title.value}`,
            });
        });

        interaction.respond(respondArray)
            .catch(err => interaction.replyTl(keys.main.errors.could_not_autocomplete_command, ph.interaction(interaction), ph.error(err)));
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
                keys.commands.advancements.no_access.advancement_disabled,
                { 'advancement_title': advancementTitle },
            );
        }

        const amFile = await server.protocol.get(FilePath.Advancements(server.worldPath, user.uuid), `./download-cache/advancements/${user.uuid}.json`);
        if(!await utils.handleProtocolResponse(amFile, server.protocol, interaction, {
            404: keys.api.command.errors.could_not_download_user_files,
        }, { category: 'advancements' }, ph.colors())) return;
        const advancementData = JSON.parse(amFile.data.toString());

        const advancementCriteria = [];
        const advancementTimestamps = [];
        let isAdvancementDone = false;

        if(category === 'recipes') {
            const allAdvancements = Object.keys(advancementData);
            const filteredAdvancement = allAdvancements.find(key => key.includes(`recipes/`) && key.endsWith(`/${advancement}`));

            const criteria = Object.keys(advancementData[filteredAdvancement]['criteria']).join('');
            const date = advancementData[filteredAdvancement]['criteria'][criteria];
            const done = advancementData[filteredAdvancement]['done'];

            if(done) isAdvancementDone = true;
            advancementCriteria.push(criteria.split(':').pop());
            advancementTimestamps.push(time(new Date(date)));
        }
        else {
            const allAdvancements = Object.keys(advancementData);
            //Filter either by category + id or just id
            const filteredAdvancement = category ?
                allAdvancements.find(key => key.split(':').pop() === `${category}/${advancement}`) :
                allAdvancements.find(key => key.endsWith(advancement));

            if(filteredAdvancement) {
                const criteriaKeys = Object.keys(advancementData[filteredAdvancement]['criteria']);
                const done = advancementData[filteredAdvancement]['done'];

                for(const criteria of criteriaKeys) {
                    const date = advancementData[filteredAdvancement]['criteria'][criteria];

                    let formattedCriteria = criteria.split(':').pop();
                    formattedCriteria = mcData.itemsByName[formattedCriteria]?.displayName ?? formattedCriteria;

                    advancementCriteria.push(formattedCriteria);
                    advancementTimestamps.push(time(new Date(date)));
                }

                if(done) isAdvancementDone = true;
            }
        }

        await interaction.replyTl(keys.commands.advancements.success, {
            'username': user.username,
            'user_icon': await getMinecraftAvatarURL(user.uuid),
            'advancement_title': advancementTitle,
            'advancement_description': advancementDesc,
            'advancement_criteria': advancementCriteria.join('\n'),
            'advancement_timestamps': advancementTimestamps.join('\n'),
            'is_done': isAdvancementDone ? keys.commands.advancements.acquired : keys.commands.advancements.not_acquired,
        });
    }
}
