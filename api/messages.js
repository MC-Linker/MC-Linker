const Discord = require('discord.js');
const keys = require('../resources/languages/expanded/en_us.json');
const { prefix } = require('../config.json');

const defaultMessage = {
    respond(key, ...placeholders) {
        return reply(null, key,...placeholders);
    },
    channel: {
        send() {}
    }
};

function addResponseMethods(interaction) {
    if(!(interaction instanceof Discord.Message) && !(interaction instanceof Discord.BaseInteraction)) return interaction;
    if(interaction instanceof Discord.AutocompleteInteraction) return interaction;

    interaction.respond = (key, ...placeholders) => reply(interaction, key, ...placeholders);
    interaction.replyOptions = options => replyOptions(interaction, options);
    return interaction;
}


const ph = {};
ph.fromAuthor = function(author) {
    if(!(author instanceof Discord.User)) return {};

    return {
        "author_username": author.username,
        "author_tag": author.tag,
        "author_id": author.id,
        "author_avatar": author.displayAvatarURL({ format: 'png' }),
        "author_timestamp": Discord.time(new Date(author.createdTimestamp)),
    }
};
ph.fromGuild = function(guild) {
    if(!(guild instanceof Discord.Guild)) return {};

    return {
        "guild_name": guild.name,
        "guild_id": guild.id,
        "guild_member_count": guild.memberCount,
        "guild_timestamp": Discord.time(new Date(guild.createdTimestamp)),
    }
};
ph.fromInteraction = function(interaction) {
    if(interaction instanceof Discord.Message) {
        const args = interaction.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        return {
            "interaction_name": commandName,
            "interaction_timestamp": Discord.time(new Date(interaction.createdTimestamp)),
            "args": args.join(' '),
        }
    } else if(interaction instanceof Discord.CommandInteraction) {
        return {
            "interaction_name": interaction.commandName,
            "interaction_timestamp": Discord.time(new Date(interaction.createdTimestamp)),
            "args": getArgs(interaction.client, interaction).join(' '),
        }
    } else if(interaction instanceof Discord.ButtonInteraction) {
        return {
            "interaction_id": interaction.customId,
            "interaction_timestamp": Discord.time(new Date(interaction.createdTimestamp)),
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
        "channel_timestamp": Discord.time(new Date(channel.createdTimestamp)),
    }
};
ph.fromClient = function(client) {
    if(!(client instanceof Discord.Client)) return {};

    return {
        "client_username": client.user.username,
        "client_tag": client.user.tag,
        "client_id": client.user.id,
        "client_avatar": client.user.displayAvatarURL({ format: 'png' }),
        "client_timestamp": Discord.time(new Date(client.user.createdTimestamp)),
    }
};
ph.emojis = function() {
    const emojis = Object.entries(keys.emojis);
    const placeholders = {};

    emojis.forEach(([name, emoji]) => placeholders[`emoji_${name}`] = emoji);

    return placeholders;
};

ph.fromCommand = function(command) {
    if(!(command instanceof Discord.ApplicationCommand)) return {};

    return {
        "command_mention": `</${command.name}:${command.id}>`,
        "command_name": command.name,
        "command_id": command.id,
        "command_short_description": command.description,
        "command_timestamp": Discord.time(new Date(command.createdTimestamp)),
    }
};

ph.fromError = function(err) {
    if(!(err instanceof Error)) return {};

    return {
        "error": err.stack,
        "error_message": err.message,
    }
};

ph.fromStd = function(interaction) {
    if(!(interaction instanceof Discord.BaseInteraction || !(interaction instanceof Discord.Message))) return {};

    return Object.assign(
        this.fromAuthor(interaction.user),
        this.fromGuild(interaction.guild),
        this.fromInteraction(interaction),
        this.fromChannel(interaction.channel),
        this.fromClient(interaction.client),
        this.emojis(),
        { "timestamp_now": Discord.time(Date.now()/1000) }
    );
};

ph.fromCommandName = async function(commandName, clientOrGuild) {
    let commands;
    if(clientOrGuild instanceof Discord.Guild) {
        commands = await clientOrGuild.commands.fetch();
    } else if(clientOrGuild instanceof Discord.Client) {
        commands = await clientOrGuild.application.commands.fetch();
    }

    const command = commands.find(cmd => cmd.name === commandName);

    if(!(command instanceof Discord.ApplicationCommand)) return {};

    return this.fromCommand(command);
};

ph.fromAllCommands = async function (clientOrGuild) {
    let commands;
    if (clientOrGuild instanceof Discord.Guild) {
        commands = await clientOrGuild.commands.fetch();
    } else if (clientOrGuild instanceof Discord.Client) {
        commands = await clientOrGuild.application.commands.fetch();
    }

    const allPh = commands.map(cmd => prependName(this.fromCommand(cmd), cmd.name));

    function prependName(ph, name) {
        const newPh = {};
        for([k, v] of Object.entries(ph)) newPh[`${name}_${k}`] = v;
        return newPh;
    }

    return Object.assign({}, ...allPh);
};


function addPh(key, ...placeholders) {
    placeholders = Object.assign({}, ...placeholders);

    if(typeof key === 'string') {
        return key.replace(/%\w+%/g, match =>
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
    //Only log to console if interaction doesnt exist
    if(key?.console && !interaction) return console.log(addPh(key.console, Object.assign({}, ...placeholders)));

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
        return interaction?.channel?.send(options);
    }

    try {
        if(!interaction?.isRepliable()) return;

        if (interaction instanceof Discord.Message) return interaction.reply(options).catch(handleError);
        else if(interaction instanceof Discord.BaseInteraction) {
            if(interaction.deferred) return interaction.editReply(options).catch(handleError);
            else return interaction.reply(options).catch(handleError);
        }
    } catch(err) {
        handleError(err);
    }
}


function getComponentBuilder(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_component_key.console);
    key = addPh(key, ...placeholders);

    const actionRow = new Discord.ActionRowBuilder();

    for(const component of Object.values(key.components)) {
        addComponent(actionRow, component);
    }

    return actionRow;
}


function getEmbedBuilder(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_embed_key.console);

    key = addPh(key, ...placeholders);

    //Create embed from key
    const embed = new Discord.EmbedBuilder();

    if(key.fields) {
        for (const field of Object.values(key.fields)) {
            if(!field.title || !field.content) continue;
            embed.addFields({ name: field.title, value: field.content, inline: field.inline });
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

    const builder = new Discord.SlashCommandBuilder()
        .setName(key.name)
        .setDescription(key.short_description)
        .setDefaultMemberPermissions(key.default_member_permissions);

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
        case Discord.ApplicationCommandOptionType.String:
            optionBuilder = new Discord.SlashCommandStringOption();

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
        case Discord.ApplicationCommandOptionType.User:
            optionBuilder = new Discord.SlashCommandUserOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addUserOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Number:
            optionBuilder = new Discord.SlashCommandNumberOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false)
                .setMinValue(key.min_value)
                .setMaxValue(key.max_value);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addNumberOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Boolean:
            optionBuilder = new Discord.SlashCommandBooleanOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addBooleanOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Integer:
            optionBuilder = new Discord.SlashCommandIntegerOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false)
                .setMinValue(key.min_value)
                .setMaxValue(key.max_value);

            if(key.choices) optionBuilder.addChoices(key.choices);

            builder.addIntegerOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Channel:
            optionBuilder = new Discord.SlashCommandChannelOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            if(key.channel_types) optionBuilder.addChannelTypes(...key.channel_types);

            builder.addChannelOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Role:
            optionBuilder = new Discord.SlashCommandRoleOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addRoleOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Mentionable:
            optionBuilder = new Discord.SlashCommandMentionableOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addMentionableOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Subcommand:
            optionBuilder = new Discord.SlashCommandSubcommandBuilder();

            optionBuilder.setName(key.name)
                .setDescription(key.description);

            if(key.options) {
                for (const option of Object.values(key.options)) {
                    addSlashCommandOption(optionBuilder, option);
                }
            }

            builder.addSubcommand(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Attachment:
            optionBuilder = new Discord.SlashCommandAttachmentOption();

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
        case Discord.ComponentType.Button:
            if(!key.style) return;

            componentBuilder = new Discord.ButtonBuilder()
                .setCustomId(key.id)
                .setDisabled(key.disabled ?? false)
                .setStyle(key.style);

            if(key.emoji) componentBuilder.setEmoji(key.emoji);
            if(key.url) componentBuilder.setURL(key.url);
            if(key.label) componentBuilder.setLabel(key.label);

            break;
        case Discord.ComponentType.SelectMenu:
            if(!key.options) return;

            componentBuilder = new Discord.SelectMenuBuilder()
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

    const matches = mention.matchAll(Discord.MessageMentions.UsersPattern);
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
        if(option.type === Discord.ApplicationCommandOptionType.SubcommandGroup || Discord.ApplicationCommandOptionType.Subcommand) {
            args.push(option.name);
            option.options.forEach(opt => addArgs(opt));
        } else if(option.type === Discord.ApplicationCommandOptionType.User && option.name === 'user') args.push(getUsersFromMention(client, option.value)?.[0] ?? option.value);
        else if(option.type === Discord.ApplicationCommandOptionType.Channel) args.push(option.channel);
        else if(option.type === Discord.ApplicationCommandOptionType.Role) args.push(option.role);
        else if(option.type === Discord.ApplicationCommandOptionType.Attachment) args.push(option.attachment);
        else args.push(option.value);
    }

    interaction.options.data.forEach(option => addArgs(option));

    return args;
}

module.exports = { keys, ph, reply, replyOptions, addResponseMethods, addPh, defaultMessage, getCommandBuilder, getEmbedBuilder, getComponentBuilder, getUsersFromMention, getArgs };