const Builders = require('@discordjs/builders');
const Discord = require('discord.js');
const keys = require('../resources/languages/expanded/english.json');
const { prefix } = require('../config.json');

const ph = {};
ph.fromAuthor = function(author) {
    if(!author instanceof Discord.User) return {};

    return {
        "author_name": author.name,
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
        "client_name": client.user.name,
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

ph.from = function(author = null, guild = null, channel = null, interaction = null, client = null) {
    return Object.assign(
        this.fromAuthor(author),
        this.fromGuild(guild),
        this.fromInteraction(interaction),
        this.fromChannel(channel),
        this.fromClient(client),
        this.emojis(),
        { "timestamp_now": Builders.time(Date.now()) }
    );
}


function addPlaceholders(key, placeholders) {
    if(typeof key === 'string') {
        return key.replace(/%\w+%/g, match => {
            return placeholders[match.replaceAll('%', '')] ?? match;
        });
    } else if(typeof key !== 'object') return;

    const entries = Object.entries(key);
    const replacedObject = {};

    for([k, v] of entries) {
        if(typeof v !== 'string') continue;
        replacedObject[k] = addPlaceholders(Object.entries(v), placeholders);
    }

    return replacedObject;
}

function reply(interaction, key, ...placeholders) {
    if(!interaction || !key || !placeholders) return console.error('Could not reply: No message, key or placeholders specified');
    else if(!key.title || !key.description) return console.error('Could not reply: No title or description specified');

    placeholders = Object.assign(
        ph.from(
            interaction.member.user ?? interaction.user,
            interaction.guild,
            interaction.channel,
            interaction,
            interaction.client,
        ),
        ...placeholders
    );

    //Add placeholders to all keyEntries recursively and assign them to key
    const replacedKey = addPlaceholders(key, placeholders);

    //Create embed from key
    const embed = new Discord.MessageEmbed()
        .setTitle(replacedKey.title)
        .setDescription(replacedKey.description);

    if(replacedKey.fields) {
        for (const field of replacedKey.fields) {
            if(!field.title || !field.content) continue;
            embed.addField(field.title, field.content, field.inline);
        }
    }
    if(replacedKey.author) embed.setAuthor({ iconURL: replacedKey.author.icon_url, name: replacedKey.author.name, url: replacedKey.author.url });
    if(replacedKey.image) embed.setImage(replacedKey.image);
    if(replacedKey.timestamp) embed.setTimestamp(replacedKey.timestamp);
    if(replacedKey.footer) embed.setFooter({ text: replacedKey.footer.text, iconURL: replacedKey.footer.icon_url });
    if(replacedKey.url) embed.setURL(replacedKey.url);

    const options = { embeds: [embed] };

    if(replacedKey.components) {
        const actionRow = new Discord.MessageActionRow();

        //Loop over each select menu
        for (const selectMenu of replacedKey.components.select_menus) {
        if(!selectMenu.custom_id || !selectMenu.options) continue;

            const menu = new Discord.MessageSelectMenu()
                .setCustomId(selectMenu.id)
                .setMinValues(selectMenu.min_values)
                .setMaxValues(selectMenu.max_values)
                .setPlaceholder(selectMenu.placeholder)
                .setDisabled(selectMenu.disabled)
                .addOptions(selectMenu.options);

            actionRow.addComponents(menu);
        }

        //Loop over each button
        for(const button of replacedKey.components.buttons) {
            if(!button.label || !button.custom_id) continue;

            const but = new Discord.MessageButton()
                .setLabel(button.label)
                .setURL(button.url)
                .setDisabled(button.disabled)
                .setEmoji(button.emoji)
                .setCustomId(button.id)
                .setStyle(button.style);

            actionRow.addComponents(but);
        }

        options.components = [actionRow]; //Add components to message options
    }

    //Reply to interaction
    if(replacedKey.console) console.log(replacedKey.console);
    if(interaction instanceof Discord.Message || !interaction?.deferred) return interaction.reply(options);
    else return interaction.editReply(options);
}


function getBuilder(key) {
    if(!key) return console.error('Could not get builder: No key specified');
    if(!key.name || !key.short_description) return console.error('Could not reply: No name or short description specified');

    const builder = new Builders.SlashCommandBuilder()
        .setName(key.name)
        .setDescription(key.description)
        .setDefaultPermission(key.default_permission);

    if(!key.options) return builder;

    for (const option of key.options) {
        addOption(builder, option);
    }
}

function addOption(builder, key) {
    if(!key.type || !key.name || !key.description) return;

    let optionBuilder;
    switch(key.type.toUpperCase()) {
        case 'STRING':
            optionBuilder = new Builders.SlashCommandStringOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required)
                .setAutocomplete(key.autocomplete);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addStringOption(optionBuilder);
            break;
        case 'USER':
            optionBuilder = new Builders.SlashCommandUserOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required);

            builder.addUserOption(optionBuilder);
            break;
        case 'NUMBER':
            optionBuilder = new Builders.SlashCommandNumberOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required)
                .setAutocomplete(key.autocomplete)
                .setMinValue(key.min_value)
                .setMaxValue(key.max_value);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addNumberOption(optionBuilder);
            break;
        case 'BOOLEAN':
            optionBuilder = new Builders.SlashCommandBooleanOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required);

            builder.addBooleanOption(optionBuilder);
            break;
        case 'INTEGER':
            optionBuilder = new Builders.SlashCommandIntegerOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required)
                .setAutocomplete(key.autocomplete)
                .setMinValue(key.min_value)
                .setMaxValue(key.max_value);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addIntegerOption(optionBuilder);
            break;
        case 'CHANNEL':
            optionBuilder = new Builders.SlashCommandChannelOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required);

            if(key.channel_types) optionBuilder.addChannelTypes(key.channel_types);

            builder.addChannelOption(optionBuilder);
            break;
        case 'ROLE':
            optionBuilder = new Builders.SlashCommandRoleOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required);

            builder.addRoleOption(optionBuilder);
            break;
        case 'MENTIONABLE':
            optionBuilder = new Builders.SlashCommandMentionableOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required);

            builder.addMentionableOption(optionBuilder);
            break;
        case 'SUBCOMMAND':
            optionBuilder = new Builders.SlashCommandSubcommandBuilder();

            optionBuilder.setName(key.name)
                .setDescription(key.description);

            for (const option of key.options) {
                addOption(builder, option);
            }

            builder.addSubcommand(optionBuilder);
            break;
    }
}


function getArgs(interaction) {
    if(!(interaction instanceof Discord.CommandInteraction)) return [];

    const args = [];
    let options = interaction.options.data;

    //Push Subcommand group
    if(options[0].type === 'SUB_COMMAND_GROUP') {
        args.push(options[0].name);
        options = options[0].options;
    }
    //Push Subcommand
    if(options[0].type === 'SUB_COMMAND') {
        args.push(options[0].name);
        options = options[0].options;
    }

    options.forEach(option => {
        if(option.type === 'USER') args.unshift(option.user.tag);
        else args.push(option.value);
    });

    return args;
}

module.exports = { keys, ph, reply, addPlaceholders, getBuilder, getArgs };