const Builders = require('@discordjs/builders');
const Discord = require('discord.js');
const keys = require('../resources/languages/expanded/english.json');
const { prefix } = require('../config.json');

const ph = {};
ph.fromAuthor = function(author) {
    if(!author instanceof Discord.User) return {};

    return {
        "author_username": author.username,
        "author_tag": author.tag,
        "author_id": author.id,
        "author_avatar": author.displayAvatarURL({ format: 'png' }),
        "author_timestamp": Builders.time(new Date(author.createdTimestamp)),
    }
}
ph.fromGuild = function(guild) {
    if(!guild instanceof Discord.Guild) return {};

    return {
        "guild_name": guild.name,
        "guild_id": guild.id,
        "guild_member_count": guild.memberCount,
        "guild_timestamp": Builders.time(new Date(guild.createdTimestamp)),
    }
}
ph.fromInteraction = function(interaction) {
    if(interaction instanceof Discord.Message) {
        const args = interaction.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        return {
            "interaction_name": commandName,
            "interaction_timestamp": Builders.time(new Date(interaction.createdTimestamp)),
            "args": args.join(' '),
        }
    } else if(interaction instanceof Discord.CommandInteraction) {
        return {
            "interaction_name": interaction.commandName,
            "interaction_timestamp": Builders.time(new Date(interaction.createdTimestamp)),
            "args": getArgs(interaction).join(' '),
        }
    }

    return {};
}
ph.fromChannel = function(channel) {
    if(!channel instanceof Discord.TextChannel) return {};

    return {
        "channel_name": channel.name,
        "channel_description": channel.topic,
        "channel_id": channel.id,
        "channel_timestamp": Builders.time(new Date(channel.createdTimestamp)),
    }
}
ph.fromClient = function(client) {
    if(!client instanceof Discord.Client) return {};

    return {
        "client_username": client.user.username,
        "client_tag": client.user.tag,
        "client_id": client.user.id,
        "client_avatar": client.user.displayAvatarURL({ format: 'png' }),
        "client_timestamp": Builders.time(new Date(client.user.createdTimestamp)),
    }
}
ph.emojis = function() {
    const emojis = Object.entries(keys.emojis);
    const placeholders = {};

    emojis.forEach(([name, emoji]) => placeholders[`emoji_${name}`] = emoji);

    return placeholders;
}

ph.fromStd = function(interaction) {
    return Object.assign(
        this.fromAuthor(interaction.member.user ?? interaction.user),
        this.fromGuild(interaction.guild),
        this.fromInteraction(interaction),
        this.fromChannel(interaction.channel),
        this.fromClient(interaction.client),
        this.emojis(),
        { "timestamp_now": Builders.time(Date.now()/1000) }
    );
}


function addPh(key, ...placeholders) {
    placeholders = Object.assign({}, ...placeholders);

    if(typeof key === 'string') {
        return key.replace(/%\w+%/g, match =>
            placeholders[match.replaceAll('%', '')] ?? match
        );
    } else if(typeof key !== 'object') return;

    const entries = Object.entries(key);
    const replacedObject = {};

    for([k, v] of entries) {
        if(typeof v !== 'string' && typeof v !== 'object') continue;
        replacedObject[k] = addPh(v, placeholders);
    }

    return replacedObject;
}


function reply(interaction, key, ...placeholders) {
    if(!interaction || !key || !placeholders) return console.error('Could not reply: No message, key or placeholders specified');

    placeholders = Object.assign(
        ph.fromStd(interaction),
        ...placeholders
    );

    const embed = getEmbedBuilder(key, placeholders);
    const options = { embeds: [embed] };

    if(key.components) {
        const actionRow = getComponentBuilder(key, placeholders);
        options.components = [actionRow]; //Add components to message options
    }

    //Reply to interaction
    if(key.console) console.log(addPh(key.console, placeholders));
    if(interaction instanceof Discord.Message || !interaction?.deferred) return interaction.reply(options);
    else return interaction.editReply(options);
}
function replyOptions(interaction, options) {
    if(interaction instanceof Discord.Message || !interaction?.deferred) return interaction.reply(options);
    else return interaction.editReply(options);
}


function getComponentBuilder(key, ...placeholders) {
    if(!key) return console.error('Could not get component builder: No key specified');
    key = addPh(key, ...placeholders);

    const actionRow = new Discord.MessageActionRow();

    //Loop over each select menu
    for (const selectMenu of Object.values(key.select_menus ?? {})) {
        if(!selectMenu.id || !selectMenu.options) continue;

        const menu = new Discord.MessageSelectMenu()
            .setCustomId(selectMenu.id)
            .addOptions(selectMenu.options);

        if(selectMenu.min_values) menu.setMinValues(selectMenu.min_values);
        if(selectMenu.max_values) menu.setMaxValues(selectMenu.max_values);
        if(selectMenu.disabled) menu.setDisabled(selectMenu.min_values);
        if(selectMenu.placeholder) menu.setPlaceholder(selectMenu.placeholder);


        actionRow.addComponents(menu);
    }

    //Loop over each button
    for(const button of Object.values(key.buttons ?? {})) {
        if(!button.label || !button.id || !button.style) continue;

        const but = new Discord.MessageButton()
            .setLabel(button.label)
            .setCustomId(button.id)
            .setStyle(button.style);

        if(button.url) but.setURL(button.url);
        if(button.disabled) but.setDisabled(button.disabled);
        if(button.emoji) but.setEmoji(button.emoji);

        actionRow.addComponents(but);
    }

    return actionRow;
}


function getEmbedBuilder(key, ...placeholders) {
    if(!key) return console.error('Could not get embed builder: No key specified');
    else if(!key.title) return console.error('Could not get embed builder: No title specified');

    key = addPh(key, ...placeholders);

    //Create embed from key
    const embed = new Discord.MessageEmbed()
        .setTitle(key.title);

    if(key.fields) {
        for (const field of Object.values(key.fields)) {
            if(!field.name || !field.content) continue;
            embed.addField(field.name, field.content, field.inline);
        }
    }

    if(key.description) embed.setDescription(key.description);
    if(key.author) embed.setAuthor({ iconURL: key.author.icon_url, name: key.author.name, url: key.author.url });
    if(key.image) embed.setImage(key.image);
    if(key.timestamp) embed.setTimestamp(key.timestamp);
    if(key.footer) embed.setFooter({ text: key.footer.text, iconURL: key.footer.icon_url });
    if(key.url) embed.setURL(key.url);

    return embed;
}


function getCommandBuilder(key) {
    if(!key) return console.error('Could not get command builder: No key specified');
    if(!key.name || !key.short_description) return console.error('Could not get command builder: No name or short description specified');

    const builder = new Builders.SlashCommandBuilder()
        .setName(key.name)
        .setDescription(key.short_description)
        .setDefaultPermission(key.default_permission ?? true);

    if(!key.options) return builder;

    for (const option of Object.values(key.options)) {
        addOption(builder, option);
    }

    return builder;
}

function addOption(builder, key) {
    if(!key.type || !key.name || !key.description) return;

    let optionBuilder;
    switch(key.type.toUpperCase()) {
        case 'STRING':
            optionBuilder = new Builders.SlashCommandStringOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addStringOption(optionBuilder);
            break;
        case 'USER':
            optionBuilder = new Builders.SlashCommandUserOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addUserOption(optionBuilder);
            break;
        case 'NUMBER':
            optionBuilder = new Builders.SlashCommandNumberOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false)
                .setMinValue(key.min_value)
                .setMaxValue(key.max_value);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addNumberOption(optionBuilder);
            break;
        case 'BOOLEAN':
            optionBuilder = new Builders.SlashCommandBooleanOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addBooleanOption(optionBuilder);
            break;
        case 'INTEGER':
            optionBuilder = new Builders.SlashCommandIntegerOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false)
                .setMinValue(key.min_value)
                .setMaxValue(key.max_value);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addIntegerOption(optionBuilder);
            break;
        case 'CHANNEL':
            optionBuilder = new Builders.SlashCommandChannelOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            if(key.channel_types) optionBuilder.addChannelTypes(key.channel_types);

            builder.addChannelOption(optionBuilder);
            break;
        case 'ROLE':
            optionBuilder = new Builders.SlashCommandRoleOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addRoleOption(optionBuilder);
            break;
        case 'MENTIONABLE':
            optionBuilder = new Builders.SlashCommandMentionableOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addMentionableOption(optionBuilder);
            break;
        case 'SUBCOMMAND':
            optionBuilder = new Builders.SlashCommandSubcommandBuilder();

            optionBuilder.setName(key.name)
                .setDescription(key.description);

            if(key.options) {
                for (const option of Object.values(key.options)) {
                    addOption(optionBuilder, option);
                }
            }

            builder.addSubcommand(optionBuilder);
            break;
    }
}


function getArgs(interaction) {
    if(!(interaction instanceof Discord.CommandInteraction)) return [];

    const args = [];
    let options = interaction.options;

    //Push Subcommand group
    if(options._group) args.push(options._group);
    //Push Subcommand
    if(options._subcommand) args.push(options._subcommand);

    if(options._hoistedOptions[0]) {
        options._hoistedOptions.forEach(option => {
            if(option.type === 'USER') args.unshift(option.user.tag);
            else args.push(option.value);
        });
    }

    return args;
}

module.exports = { keys, ph, reply, replyOptions, addPh, getCommandBuilder, getEmbedBuilder, getComponentBuilder, getArgs };