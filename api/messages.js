const Builders = require('@discordjs/builders');
const Discord = require('discord.js');
const keys = require('../resources/languages/expanded/en_us.json');
const { prefix } = require('../config.json');

const ph = {};
ph.fromAuthor = function(author) {
    if(!(author instanceof Discord.User)) return {};

    return {
        "author_username": author.username,
        "author_tag": author.tag,
        "author_id": author.id,
        "author_avatar": author.displayAvatarURL({ format: 'png' }),
        "author_timestamp": Builders.time(new Date(author.createdTimestamp)),
    }
};
ph.fromGuild = function(guild) {
    if(!(guild instanceof Discord.Guild)) return {};

    return {
        "guild_name": guild.name,
        "guild_id": guild.id,
        "guild_member_count": guild.memberCount,
        "guild_timestamp": Builders.time(new Date(guild.createdTimestamp)),
    }
};
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
            "args": getArgs(interaction.client, interaction).join(' '),
        }
    } else if(interaction instanceof Discord.ButtonInteraction) {
        return {
            "interaction_id": interaction.customId,
            "interaction_timestamp": Builders.time(new Date(interaction.createdTimestamp)),
        }
    }

    return {};
};
ph.fromChannel = function(channel) {
    if(!(channel instanceof Discord.TextChannel)) return {};

    return {
        "channel_name": channel.name,
        "channel_description": channel.topic,
        "channel_id": channel.id,
        "channel_timestamp": Builders.time(new Date(channel.createdTimestamp)),
    }
};
ph.fromClient = function(client) {
    if(!(client instanceof Discord.Client)) return {};

    return {
        "client_username": client.user.username,
        "client_tag": client.user.tag,
        "client_id": client.user.id,
        "client_avatar": client.user.displayAvatarURL({ format: 'png' }),
        "client_timestamp": Builders.time(new Date(client.user.createdTimestamp)),
    }
};
ph.emojis = function() {
    const emojis = Object.entries(keys.emojis);
    const placeholders = {};

    emojis.forEach(([name, emoji]) => placeholders[`emoji_${name}`] = emoji);

    return placeholders;
};

ph.fromStd = function(interaction) {
    return Object.assign(
        this.fromAuthor(interaction?.member?.user ?? interaction.user),
        this.fromGuild(interaction.guild),
        this.fromInteraction(interaction),
        this.fromChannel(interaction.channel),
        this.fromClient(interaction.client),
        this.emojis(),
        { "timestamp_now": Builders.time(Date.now()/1000) }
    );
};

ph.fromError = function(err) {
    if(!(err instanceof Error)) return {};

    return {
        "error": err.stack,
        "error_message": err.message,
    }
};


function addPh(key, ...placeholders) {
    placeholders = Object.assign({}, ...placeholders);

    if(typeof key === 'string') {
        return key.replace(/%.+%/g, match =>
            placeholders[match.replaceAll('%', '')] ?? match
        );
    } else if(Array.isArray(key)) {
        let replaced = {};

        for(const string of key) {
            const match = string.match(/%.+%/g)?.shift();
            if(match) {
                const placeholder = placeholders[match.replaceAll('%', '')];

                if(Array.isArray(placeholder)) {
                    for(const v of placeholder) {
                        if(!v.match(/%.+%/g)) replaced[v] = v;
                    }
                } else if(typeof placeholder === 'object') {
                    for([k, v] of Object.entries(placeholder)) replaced[k] = v;
                } else {
                    const v = placeholder ?? match;
                    replaced[v] = v;
                }

                continue;
            }

            replaced[string] = string;
        }

        return replaced;
    } else if(typeof key === 'object') {
        const replacedObject = {};

        for([k, v] of Object.entries(key)) {
            replacedObject[k] = addPh(v, placeholders);
        }

        return replacedObject;
    } else return key;
}


function reply(interaction, key, ...placeholders) {
    if(!interaction || !key || !placeholders) return console.error(keys.api.messages.errors.no_reply_arguments.console);

    placeholders = Object.assign(
        ph.fromStd(interaction),
        ...placeholders
    );

    const options = {};

    if(key.title) {
        const embed = getEmbedBuilder(key, placeholders);
        if(embed) options.embeds = [embed]; //Add embeds to message options
    }

    if(key.components) {
        const actionRow = getComponentBuilder(key, placeholders);
        if(actionRow) options.components = [actionRow]; //Add components to message options
    }

    //Reply to interaction
    if(key.console) console.log(addPh(key.console, placeholders));

    if(!options.embeds) return; //If only console don't reply
    return replyOptions(interaction, options);
}

function replyOptions(interaction, options) {
    function handleError(err) {
        console.log(addPh(keys.api.messages.errors.could_not_reply.console, ph.fromError(err), { "interaction": interaction }));
        interaction?.channel?.send(options);
    }

    try {
        if (interaction instanceof Discord.Message || !interaction?.deferred) return interaction.reply(options).catch(handleError);
        else return interaction.editReply(options).catch(handleError);
    } catch(err) {
        handleError(err);
    }
}


function getComponentBuilder(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_component_key.console);
    key = addPh(key, ...placeholders);

    const actionRow = new Discord.MessageActionRow();

    for(const component of Object.values(key.components)) {
        addComponent(actionRow, component);
    }

    return actionRow;
}


function getEmbedBuilder(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_embed_key.console);

    key = addPh(key, ...placeholders);

    //Create embed from key
    const embed = new Discord.MessageEmbed();

    if(key.fields) {
        for (const field of Object.values(key.fields)) {
            if(!field.title || !field.content) continue;
            embed.addField(field.title, field.content, field.inline);
        }
    }

    if(key.title) embed.setTitle(key.title);
    if(key.description) embed.setDescription(key.description);
    if(key.color) embed.setColor(key.color);
    if(key.author) embed.setAuthor({ iconURL: key.author.icon_url, name: key.author.name, url: key.author.url });
    if(key.image) embed.setImage(key.image);
    if(key.thumbnail) embed.setThumbnail(key.thumbnail);
    if(key.timestamp) embed.setTimestamp(Number(key.timestamp));
    if(key.footer) embed.setFooter({ text: key.footer.text, iconURL: key.footer.icon_url });
    if(key.url) embed.setURL(key.url);

    return embed;
}


function getCommandBuilder(key) {
    if(!key) return console.error(keys.api.messages.errors.no_command_key.console);
    if(!key.name || !key.short_description) return console.error(keys.api.messages.errors.no_command_arguments.console);

    const builder = new Builders.SlashCommandBuilder()
        .setName(key.name)
        .setDescription(key.short_description)
        .setDefaultPermission(key.default_permission ?? true);

    if(!key.options) return builder;

    for (const option of Object.values(key.options)) {
        addSlashCommandOption(builder, option);
    }

    return builder;
}

function addSlashCommandOption(builder, key) {
    if(!key.type || !key.name || !key.description) return;

    let optionBuilder;
    switch(key.type.toUpperCase()) {
        case 'STRING':
            optionBuilder = new Builders.SlashCommandStringOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false);

            if(key.choices) {
                for(const choice of key.choices) {
                    optionBuilder.addChoices({ name: choice[0], value: choice[1] });
                }
            }

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

            if(key.channel_types) optionBuilder.addChannelTypes(...key.channel_types);

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
                    addSlashCommandOption(optionBuilder, option);
                }
            }

            builder.addSubcommand(optionBuilder);
            break;
        case 'ATTACHMENT':
            optionBuilder = new Builders.SlashCommandAttachmentOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addAttachmentOption(optionBuilder);
            break;
    }
}

function addComponent(actionRow, key) {
    if(!key.type || !key.id) return;

    let componentBuilder;
    switch(key.type.toUpperCase()) {
        case 'BUTTON':
            if(!key.style) return;

            componentBuilder = new Discord.MessageButton()
                .setCustomId(key.id)
                .setDisabled(key.disabled ?? false)
                .setStyle(key.style);

            if(key.emoji) componentBuilder.setEmoji(key.emoji);
            if(key.url) componentBuilder.setURL(key.url);
            if(key.label) componentBuilder.setLabel(key.label);

            break;
        case 'SELECT_MENU':
            if(!key.options) return;

            componentBuilder = new Discord.MessageSelectMenu()
                .setCustomId(key.id)
                .setDisabled(key.disabled ?? false)
                .setMinValues(key.min_values)
                .setMaxValues(key.max_values);

            if(key.placeholder) componentBuilder.setPlaceholder(key.placeholder);
            if(key.options) componentBuilder.addOptions(...Object.values(key.options));

            break;
    }

    actionRow.addComponents(componentBuilder);
}

function getUsersFromMention(client, mention) {
    if(typeof mention !== 'string') return [];

    const matches = mention.matchAll(Discord.MessageMentions.USERS_PATTERN);
    if (!matches) return [];

    const userArray = [];
    for (let match of matches) {
        // match[0] = entire mention
        // match[1] = Id
        userArray.push(client.users.cache.get(match[1]));
    }

    return userArray;
}

function getArgs(client, interaction) {
    if(!(interaction instanceof Discord.CommandInteraction)) return [];

    const args = [];

    function addArgs(option) {
        if(option.type === 'SUB_COMMAND_GROUP' || option.type === 'SUB_COMMAND') {
            args.push(option.name);
            option.options.forEach(opt => addArgs(opt));
        } else if(option.type === 'STRING' && option.name === 'user') args.push(getUsersFromMention(client, option.value)?.[0] ?? option.value);
        else if(option.type === 'CHANNEL') args.push(option.channel);
        else if(option.type === 'ROLE') args.push(option.role);
        else if(option.type === 'ATTACHMENT') args.push(option.attachment);
        else args.push(option.value);
    }

    interaction.options.data.forEach(option => addArgs(option));

    return args;
}

module.exports = { keys, ph, reply, replyOptions, addPh, getCommandBuilder, getEmbedBuilder, getComponentBuilder, getUsersFromMention, getArgs };