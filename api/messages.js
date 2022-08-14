const Discord = require('discord.js');
const keys = require('../resources/languages/expanded/en_us.json');
const { prefix } = require('../config.json');

const defaultMessage = {
    respond(key, ...placeholders) {
        return reply(null, key, ...placeholders);
    },
    channel: {
        send(content) {},
    },
};

function addResponseMethods(interaction) {
    if(!(interaction instanceof Discord.Message) && !(interaction instanceof Discord.BaseInteraction)) return interaction;
    if(interaction instanceof Discord.AutocompleteInteraction) return interaction;

    interaction.respond = (key, ...placeholders) => reply(interaction, key, ...placeholders);
    interaction.replyOptions = options => replyOptions(interaction, options);
    return interaction;
}


const ph = {};
ph.author = function(author) {
    if(!(author instanceof Discord.User)) return {};

    return {
        'author_username': author.username,
        'author_tag': author.tag,
        'author_id': author.id,
        'author_avatar': author.displayAvatarURL({ extension: Discord.ImageFormat.PNG }),
        'author_timestamp': Discord.time(new Date(author.createdTimestamp)),
    };
};
ph.guild = function(guild) {
    if(!(guild instanceof Discord.Guild)) return {};

    return {
        'guild_name': guild.name,
        'guild_id': guild.id,
        'guild_member_count': guild.memberCount,
        'guild_timestamp': Discord.time(new Date(guild.createdTimestamp)),
    };
};
ph.interaction = function(interaction) {
    if(interaction instanceof Discord.Message) {
        const args = interaction.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        return {
            'interaction_name': commandName,
            'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
            'args': args.join(' '),
        };
    }
    else if(interaction instanceof Discord.CommandInteraction) {
        return {
            'interaction_name': interaction.commandName,
            'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
            'args': getArgs(interaction.client, interaction).join(' '),
        };
    }
    else if(interaction instanceof Discord.ButtonInteraction) {
        return {
            'interaction_id': interaction.customId,
            'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
        };
    }

    return {};
};
ph.channel = function(channel) {
    if(!(channel instanceof Discord.TextChannel)) return {};

    return {
        'channel_name': channel.name,
        'channel_description': channel.topic,
        'channel_id': channel.id,
        'channel_timestamp': Discord.time(new Date(channel.createdTimestamp)),
    };
};
ph.client = function(client) {
    if(!(client instanceof Discord.Client)) return {};

    return {
        'client_username': client.user.username,
        'client_tag': client.user.tag,
        'client_id': client.user.id,
        'client_avatar': client.user.displayAvatarURL({ extension: Discord.ImageFormat.PNG }),
        'client_timestamp': Discord.time(new Date(client.user.createdTimestamp)),
    };
};
ph.emojis = function() {
    const emojis = Object.entries(keys.emojis);
    const placeholders = {};

    emojis.forEach(([name, emoji]) => placeholders[`emoji_${name}`] = emoji);

    return placeholders;
};

ph.command = function(command) {
    if(!(command instanceof Discord.ApplicationCommand)) return {};

    return {
        'command_mention': `</${command.name}:${command.id}>`,
        'command_name': command.name,
        'command_id': command.id,
        'command_description': command.description,
        'command_timestamp': Discord.time(new Date(command.createdTimestamp)),
    };
};

ph.error = function(err) {
    if(!(err instanceof Error)) return {};

    return {
        'error': err.stack,
        'error_message': err.message,
    };
};

ph.std = function(interaction) {
    if(!(interaction instanceof Discord.BaseInteraction) && !(interaction instanceof Discord.Message)) return {};

    return Object.assign(
        this.author(interaction.member.user),
        this.guild(interaction.guild),
        this.interaction(interaction),
        this.channel(interaction.channel),
        this.client(interaction.client),
        this.emojis(),
        { 'timestamp_now': Discord.time(Date.now() / 1000) },
    );
};

ph.commandName = async function(commandName, client) {
    if(!(client instanceof Discord.Client)) return {};

    let commands = await client.application.commands.fetch();
    const command = commands.find(cmd => cmd.name === commandName);
    if(!command) return {};

    return this.command(command);
};

ph.allCommands = async function(client) {
    if(!(client instanceof Discord.Client)) return {};

    let commands = await client.application.commands.fetch();

    const allPh = commands.map(cmd => prependName(this.command(cmd), cmd.name));
    return Object.assign({}, ...allPh);

    function prependName(ph, name) {
        const newPh = {};
        for([k, v] of Object.entries(ph)) newPh[`${name}_${k}`] = v;
        return newPh;
    }
};


function addPh(key, ...placeholders) {
    placeholders = Object.assign({}, ...placeholders);

    if(typeof key === 'string') {
        return key.replace(/%\w+%/g, match =>
            placeholders[match.replaceAll('%', '')] ?? match,
        );
    }
    else if(Array.isArray(key)) {
        let replaced = [];

        for(let i = 0; i < key.length; i++) {
            const string = key[i];

            if(typeof string === 'object') {
                replaced.push(addPh(string, placeholders));
                continue;
            }

            const match = string.match(/%.+%/g)?.shift();
            if(match) {
                const placeholder = placeholders[match.replaceAll('%', '')];

                if(Array.isArray(placeholder)) {
                    for(const v of placeholder) {
                        if(!v.match(/%.+%/g)) replaced.push(v);
                    }
                }
                else if(typeof placeholder === 'object') {
                    replaced = {};
                    for([k, v] of Object.entries(placeholder)) replaced[k] = v;
                }
                else {
                    const v = placeholder ?? match;
                    replaced.push(v);
                }

                continue;
            }

            replaced.push(string);
        }

        return replaced;
    }
    else if(typeof key === 'object') {
        const replacedObject = {};

        for([k, v] of Object.entries(key)) {
            replacedObject[k] = addPh(v, placeholders);
        }

        return replacedObject;
    }
    else return key;
}


function reply(interaction, key, ...placeholders) {
    //Only log to console if interaction doesn't exist
    // noinspection JSUnresolvedVariable
    if(key?.console && !interaction) return console.log(addPh(key.console, Object.assign({}, ...placeholders)));

    if(!interaction || !key || !placeholders) return console.error(keys.api.messages.errors.no_reply_arguments.console);

    placeholders = Object.assign(
        ph.std(interaction),
        ...placeholders,
    );

    const options = {
        embeds: [],
        components: [],
    };

    for(let embed of key?.embeds ?? []) {
        embed = getEmbed(embed, placeholders);
        if(embed) options.embeds.push(embed); //Add embeds to message options
    }

    if(key.components) {
        const actionRow = getActionRow(key, placeholders);
        if(actionRow) options.components.push(actionRow); //Add components message options
    }

    //Reply to interaction
    // noinspection JSUnresolvedVariable
    if(key.console) console.log(addPh(key.console, placeholders));

    if(!key.embeds && !key.components && !key.files) return; //If only console don't reply
    return replyOptions(interaction, options);
}

function replyOptions(interaction, options) {
    function handleError(err) {
        console.log(addPh(keys.api.messages.errors.could_not_reply.console, ph.error(err), { 'interaction': interaction }));
        return interaction?.channel?.send(options);
    }

    try {
        if(!interaction?.isRepliable?.()) return interaction?.channel?.send(options);

        if(interaction instanceof Discord.Message) return interaction.reply(options).catch(handleError);
        else if(interaction instanceof Discord.BaseInteraction) {
            if(interaction.deferred) return interaction.editReply(options).catch(handleError);
            else return interaction.reply(options).catch(handleError);
        }
    }
    catch(err) {
        handleError(err);
    }
}


function getEmbed(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_embed_key.console);

    //Get first embed
    if(key.embeds) key = key.embeds[0];

    key = addPh(key, ...placeholders);

    const embed = new Discord.EmbedBuilder();

    for(const field of key?.fields ?? []) {
        if(!field.name || !field.value) continue;
        embed.addFields({ name: field.name, value: field.value, inline: field.inline });
    }

    if(key.title) embed.setTitle(key.title);
    if(key.description) embed.setDescription(key.description);
    if(key.color) embed.setColor(key.color);
    if(key.author?.name) embed.setAuthor({ iconURL: key.author.icon_url, name: key.author.name, url: key.author.url });
    if(key.image) embed.setImage(key.image);
    if(key.thumbnail) embed.setThumbnail(key.thumbnail);
    if(key.timestamp) embed.setTimestamp(Number(key.timestamp));
    if(key.footer?.text) embed.setFooter({ text: key.footer.text, iconURL: key.footer.icon_url });
    if(key.url) embed.setURL(key.url);

    return embed;
}

function getActionRow(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_component_key.console);

    const actionRow = new Discord.ActionRowBuilder();

    for(let component of key.components) {
        component = getComponent(component, ...placeholders);
        if(component) actionRow.addComponents(component);
    }

    return actionRow;
}

function getComponent(key, ...placeholders) {
    if(!key.type) return;
    key = addPh(key, ...placeholders);

    let componentBuilder;
    switch(Discord.ComponentType[key.type]) {
        case Discord.ComponentType.Button:
            if(!key.style) return;

            componentBuilder = new Discord.ButtonBuilder()
                .setDisabled(key.disabled ?? false)
                .setStyle(Discord.ButtonStyle[key.style]);

            if(key.custom_id) componentBuilder.setCustomId(key.custom_id);
            if(key.emoji) componentBuilder.setEmoji(key.emoji);
            if(key.url) componentBuilder.setURL(key.url);
            if(key.label) componentBuilder.setLabel(key.label);

            break;
        case Discord.ComponentType.SelectMenu:
            if(!key.options || !key.custom_id) return;

            componentBuilder = new Discord.SelectMenuBuilder()
                .setCustomId(key.custom_id)
                .setDisabled(key.disabled ?? false);

            if(key.min_values) componentBuilder.setMinValues(key.min_values);
            if(key.max_values) componentBuilder.setMaxValues(key.max_values);
            if(key.placeholder) componentBuilder.setPlaceholder(key.placeholder);

            for(const option of key?.options ?? []) {
                if(!option.label || !option.value) return;

                const optionBuilder = new Discord.SelectMenuOptionBuilder()
                    .setLabel(option.label)
                    .setValue(option.value)
                    .setDefault(key.default ?? false);

                if(option.description) optionBuilder.setDescription(option.description);
                if(option.emoji) optionBuilder.setEmoji(option.emoji);

                componentBuilder.addOptions(option);
            }

            break;
        case Discord.ComponentType.TextInput:
            if(!key.style || !key.custom_id || !key.label) return;

            componentBuilder = new Discord.TextInputBuilder()
                .setStyle(Discord.TextInputStyle[key.style])
                .setCustomId(key.custom_id)
                .setLabel(key.label)
                .setDisabled(key.disabled ?? false)
                .setRequired(key.required ?? false);

            if(key.max_length) componentBuilder.setMaxLength(key.max_length);
            if(key.min_length) componentBuilder.setMinLength(key.min_length);
            if(key.value) componentBuilder.setValue(key.value);
            if(key.placeholder) componentBuilder.setPlaceholder(key.placeholder);
            if(key.label) componentBuilder.setLabel(key.label);

            break;
    }

    return componentBuilder;
}

function getCommand(key) {
    if(!key) return console.error(keys.api.messages.errors.no_command_key.console);
    if(!key.name || !key.type) return console.error(keys.api.messages.errors.no_command_arguments.console);

    let commandBuilder;
    switch(Discord.ApplicationCommandType[key.type]) {
        case Discord.ApplicationCommandType.ChatInput:
            if(!key.description) return;

            commandBuilder = new Discord.SlashCommandBuilder()
                .setName(key.name)
                .setDescription(key.description);

            if(key.default_member_permissions) commandBuilder.setDefaultMemberPermissions(key.default_member_permissions);
            if(key.dm_permission) commandBuilder.setDMPermission(key.dm_permission);

            for(const option of key.options) {
                addSlashCommandOption(commandBuilder, option);
            }

            break;
        case Discord.ApplicationCommandType.Message:
        case Discord.ApplicationCommandType.User:
            if(!key.description) return;

            commandBuilder = new Discord.ContextMenuCommandBuilder()
                .setName(key.name)
                .setType(key.type);


            if(key.default_member_permissions) commandBuilder.setDefaultMemberPermissions(key.default_member_permissions);
            if(key.dm_permission) commandBuilder.setDMPermission(key.dm_permission);

            break;
    }

    return commandBuilder;
}

function addSlashCommandOption(builder, key) {
    if(!key.type || !key.name || !key.description) return;

    let optionBuilder;
    switch(Discord.ApplicationCommandOptionType[key.type]) {
        case Discord.ApplicationCommandOptionType.String:
            optionBuilder = new Discord.SlashCommandStringOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false)
                .setAutocomplete(key.autocomplete ?? false);

            if(key.max_length) optionBuilder.setMaxLength(key.max_length);
            if(key.min_length) optionBuilder.setMinLength(key.max_length);

            for(const choice of key?.choices ?? []) {
                if(!choice.name || !choice.value) continue;
                optionBuilder.addChoices(choice);
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
                .setAutocomplete(key.autocomplete ?? false);

            if(key.min_value) optionBuilder.setMinValue(key.min_value);
            if(key.max_value) optionBuilder.setMaxValue(key.max_value);

            for(const choice of key?.choices ?? []) {
                if(!choice.name || !choice.value) continue;
                optionBuilder.addChoices(choice);
            }

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
                .setAutocomplete(key.autocomplete ?? false);

            if(key.min_value) optionBuilder.setMinValue(key.min_value);
            if(key.max_value) optionBuilder.setMaxValue(key.max_value);

            for(const choice of key?.choices ?? []) {
                if(!choice.name || !choice.value) continue;
                optionBuilder.addChoices(choice);
            }

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
        case Discord.ApplicationCommandOptionType.Attachment:
            optionBuilder = new Discord.SlashCommandAttachmentOption();

            optionBuilder.setName(key.name)
                .setDescription(key.description)
                .setRequired(key.required ?? false);

            builder.addAttachmentOption(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.SubcommandGroup:
            optionBuilder = new Discord.SlashCommandSubcommandGroupBuilder();

            optionBuilder.setName(key.name)
                .setDescription(key.description);

            for(const option of key?.options ?? []) {
                addSlashCommandOption(optionBuilder, option);
            }

            optionBuilder = builder.addSubcommandGroup(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Subcommand:
            optionBuilder = new Discord.SlashCommandSubcommandBuilder();

            optionBuilder.setName(key.name)
                .setDescription(key.description);

            for(const option of key?.options ?? []) {
                addSlashCommandOption(optionBuilder, option);
            }

            optionBuilder = builder.addSubcommand(optionBuilder);
            break;
    }
}


function getUsersFromMention(client, mention) {
    if(typeof mention !== 'string') return [];

    const usersPattern = new RegExp(Discord.MessageMentions.UsersPattern.source, 'g');
    const matches = mention.matchAll(usersPattern);
    if(!matches) return [];

    const userArray = [];
    for(let match of matches) {
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
        if(option.type === Discord.ApplicationCommandOptionType.SubcommandGroup || option.type === Discord.ApplicationCommandOptionType.Subcommand) {
            args.push(option.name);
            option.options.forEach(opt => addArgs(opt));
        }
        else if(option.type === Discord.ApplicationCommandOptionType.String && option.name === 'user')
            args.push(getUsersFromMention(client, option.value)?.[0] ?? option.value);
        else if(option.type === Discord.ApplicationCommandOptionType.Channel) args.push(option.channel);
        else if(option.type === Discord.ApplicationCommandOptionType.User) args.push(option.user);
        else if(option.type === Discord.ApplicationCommandOptionType.Role) args.push(option.role);
        else if(option.type === Discord.ApplicationCommandOptionType.Attachment) args.push(option.attachment);
        else args.push(option.value);
    }

    interaction.options.data.forEach(option => addArgs(option));

    return args;
}

module.exports = {
    keys,
    ph,
    reply,
    replyOptions,
    addPh,
    getEmbed,
    getCommand,
    getActionRow,
    addResponseMethods,
    defaultMessage,
    getUsersFromMention,
    getArgs,
};