const fs = require('fs');
const Discord = require('discord.js');
const settings = require('../../api/settings');
const ftp = require('../../api/ftp');
const utils = require('../../api/utils');
const { time } = require('@discordjs/builders');

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

    interaction.respond(respondArray).catch(err => console.log(`Could not respond to autocomplete ${interaction.commandName}`, err));
}

async function execute(message, args) {
    const username = message.mentions.users.first()?.tag ?? args[0];
    args.shift();
    const category = args.shift()?.toLowerCase();
    let advancement = args.join(' ')?.toLowerCase();

    if(!username) {
        console.log(`${message.member.user.tag} executed /advancements without username in ${message.guild.name}`);
        message.reply(':warning: Please ping a user or specify a minecraft-username.');
        return;
    } else if(!category) {
        console.log(`${message.member.user.tag} executed /advancements without tab in ${message.guild.name}`);
        message.reply(':warning: Please specify the advancement category.\n(`story`, `nether`, `end`, `adventure`, `husbandry`)');
        return;
    } else if(!advancement) {
        console.log(`${message.member.user.tag} executed /advancements without advancement in ${message.guild.name}`);
        message.reply(':warning: Please specify the advancement name or id.');
        return;
    }

    const matchingAdvancement = await utils.searchAdvancements(advancement, category, true, 1);
    advancement = matchingAdvancement.shift()?.value ?? advancement;

    console.log(`${message.member.user.tag} executed /advancements ${username} ${category} ${advancement} in ${message.guild.name}`);

    //Get Advancement Title and Description from lang file
    let advancementTitle;
    let advancementDesc;
    try {
        const langData = JSON.parse(await fs.promises.readFile('./resources/languages/test.json', 'utf-8'));
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

    if(await settings.isDisabled(message.guildId, 'advancements', category)) {
        console.log(`Advancement category [${category}] disabled.`);
        message.reply(`:no_entry: Advancement category [**${category}**] disabled!`);
        return;
    }
    if(await settings.isDisabled(message.guildId, 'advancements', advancement)) {
        console.log(`Advancement [${advancement}] disabled.`);
        message.reply(`:no_entry: Advancement [**${advancementTitle}**] disabled!`);
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
            message.reply('<:Error:849215023264169985> Could not read advancement file. Please try again.');
            console.log('Error reading advancement file from disk: ', err);
            return;
        }

        const advancementData = JSON.parse(advancementJson);

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
                const allAdvancements = Object.keys(advancementData);
                const filteredAdvancement = allAdvancements.find(key => key.includes(`recipes/`) && key.endsWith(`/${advancement}`));

                const criteria = Object.keys(advancementData[filteredAdvancement]['criteria']).join('');
                const date = advancementData[filteredAdvancement]['criteria'][criteria];
                const done = advancementData[filteredAdvancement]['done'];

                amEmbed = baseEmbed.addField('Requirement', criteria)
                    .addField('unlocked on', time(new Date(date)));

                if(!done) amEmbed.setFooter({ text: 'Advancement not unlocked/completed.', iconURL: 'https://cdn.discordapp.com/emojis/849215023264169985.png' });
                else amEmbed.setFooter({ text: 'Advancement completed/unlocked.', iconURL: 'https://cdn.discordapp.com/emojis/849224496232660992.png' });
            } else {
                const allAdvancements = Object.keys(advancementData);
                const filteredAdvancement = allAdvancements.find(key => key.includes(category) && key.endsWith(advancement));

                const keys = Object.keys(advancementData[filteredAdvancement]['criteria']);
                const done = advancementData[filteredAdvancement]['done'];

                let counter = 0;
                let amString = '';
                for (const key of keys) {
                    const date = advancementData[filteredAdvancement]['criteria'][key];
                    amString += `\n**Requirement**\n${key.split(':').pop()}\n**Completed on**\n${time(new Date(date))}\n`;

                    if(counter === 1 || keys.length === 1) {
                        amEmbed = baseEmbed.addField('\u200b', amString, true);
                        amString = ''; counter = 0;
                    } else counter++;
                }

                if(!done) amEmbed.setFooter({ text: 'Advancement not unlocked/completed.', iconURL: 'https://cdn.discordapp.com/emojis/849215023264169985.png' });
                else amEmbed.setFooter({ text: 'Advancement completed/unlocked.', iconURL: 'https://cdn.discordapp.com/emojis/849224496232660992.png' });
            }

            console.log(`Sent advancement [${advancementTitle}] of ${username}`);
            message.reply({ embeds: [amEmbed] });
        } catch (err) {
            console.log('Advancement not completed');
            message.reply(`:warning: Advancement [**${advancementTitle}**] not completed/unlocked or misspelled!`);
        }
    })
}

module.exports = { execute, autocomplete };