const { AnyComponent } = require('discord.js');

const Discord = require('discord.js');
const {
    MessagePayload,
    InteractionReplyOptions,
    WebhookEditMessageOptions,
    Message,
    InteractionResponse,
    Channel,
    BaseInteraction,
    User,
    Guild,
    ApplicationCommand,
    Client,
    EmbedBuilder,
    ActionRowBuilder,
    APIEmbed,
    APIActionRowComponent,
    APIApplicationCommand,
    SlashCommandBuilder,
    MessageReplyOptions,
    ComponentType,
    ComponentBuilder,
} = require('discord.js');
const { getSlashCommand } = require('./utils');
const { prefix } = require('../config.json');
const { keys } = require('./keys');

/**
 * Default placeholders for discord.js structures.
 * @type {object}
 */
const ph = {

    /**
     * Placeholders for an author.
     * @param {User} author - The author to get placeholders for.
     * @returns {{}|{author_id: string, author_avatar: string, author_username: string, author_timestamp: `<t:${bigint}>`, author_tag: string}}
     */
    author(author) {
        if(!(author instanceof Discord.User)) return {};

        return {
            'author_username': author.username,
            'author_tag': author.tag,
            'author_id': author.id,
            'author_avatar': author.displayAvatarURL({ extension: Discord.ImageFormat.PNG }),
            'author_timestamp': Discord.time(new Date(author.createdTimestamp)),
        };
    },

    /**
     * Placeholders for a guild.
     * @param {Guild} guild - The guild to get placeholders for.
     * @returns {{}|{guild_name: string, guild_member_count: number, guild_id: string, guild_timestamp: `<t:${bigint}>`}}
     */
    guild(guild) {
        if(!(guild instanceof Discord.Guild)) return {};

        return {
            'guild_name': guild.name,
            'guild_id': guild.id,
            'guild_member_count': guild.memberCount,
            'guild_timestamp': Discord.time(new Date(guild.createdTimestamp)),
        };
    },

    /**
     * Placeholders for an interaction.
     * @param {BaseInteraction|Message} interaction - The interaction to get placeholders for.
     * @returns {{}|{args?: string, interaction_name: string, interaction_timestamp: `<t:${bigint}>`}}
     */
    interaction(interaction) {
        if(interaction instanceof Discord.Message) {
            const args = interaction.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            return {
                'interaction_name': commandName,
                'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
            };
        }
        else if(interaction instanceof Discord.CommandInteraction) {
            return {
                'interaction_name': interaction.commandName,
                'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
            };
        }
        else if(interaction instanceof Discord.ButtonInteraction) {
            return {
                'interaction_id': interaction.customId,
                'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
            };
        }

        return {};
    },

    /**
     * Placeholders for a channel.
     * @param {Channel} channel - The channel to get placeholders for.
     * @returns {{}|{channel_name: string, channel_timestamp: `<t:${bigint}>`, channel_description: string, channel_id: string}}
     */
    channel(channel) {
        if(!(channel instanceof Discord.TextChannel)) return {};

        return {
            'channel_name': channel.name,
            'channel_description': channel.topic,
            'channel_id': channel.id,
            'channel_timestamp': Discord.time(new Date(channel.createdTimestamp)),
        };
    },

    /**
     * Placeholders for the client.
     * @param {Client} client - The client to get placeholders for.
     * @returns {{}|{client_timestamp: `<t:${bigint}>`, client_username: string, client_avatar: string, client_tag: string, client_id: string}}
     */
    client(client) {
        if(!(client instanceof Discord.Client)) return {};

        return {
            'client_username': client.user.username,
            'client_tag': client.user.tag,
            'client_id': client.user.id,
            'client_avatar': client.user.displayAvatarURL({ extension: Discord.ImageFormat.PNG }),
            'client_timestamp': Discord.time(new Date(client.user.createdTimestamp)),
        };
    },

    /**
     * Emoji placeholders.
     * @returns {object}
     */
    emojis() {
        const emojis = Object.entries(keys.emojis);
        const placeholders = {};

        emojis.forEach(([name, emoji]) => placeholders[`emoji_${name}`] = emoji);

        return placeholders;
    },

    /**
     * Placeholders for a command.
     * @param {ApplicationCommand} command - The command to get placeholders for.
     * @returns {{}|{command_id: string, command_timestamp: `<t:${bigint}>`, command_name: string, command_description: string, command_mention: string}}
     */
    command(command) {
        if(!(command instanceof Discord.ApplicationCommand)) return {};

        return {
            'command_mention': `</${command.name}:${command.id}>`,
            'command_name': command.name,
            'command_id': command.id,
            'command_description': command.description,
            'command_timestamp': Discord.time(new Date(command.createdTimestamp)),
        };
    },

    /**
     * Placeholders for an error.
     * @param {Error} err - The error to get placeholders for.
     * @returns {{}|{error_message: string, error: string}}
     */
    error(err) {
        if(!(err instanceof Error)) return {};

        return {
            'error': err.stack,
            'error_message': err.message,
        };
    },

    /**
     * Standard placeholders for an interaction.
     * @param {BaseInteraction|Message} interaction - The interaction to get placeholders for.
     * @returns {object}
     */
    std(interaction) {
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
    },

    /**
     * Placeholders for a command by name.
     * @param {string} commandName - The name of the command to get placeholders for.
     * @param {Client} client - The client to get the command from.
     * @returns {Promise<{}|{command_id: string, command_timestamp: `<t:${bigint}>`, command_name: string, command_description: string, command_mention: string}>}
     */
    async commandName(commandName, client) {
        if(!(client instanceof Discord.Client)) return {};

        const command = await getSlashCommand(client.application.commands, commandName);
        if(!command) return {};

        return this.command(command);
    },

    /**
     * Placeholders for all commands.
     * @param {Client} client - The client to get the commands from.
     * @returns {Promise<object>}
     */
    async allCommands(client) {
        if(!(client instanceof Discord.Client)) return {};

        let commands = await client.application.commands.fetch();

        const allPh = commands.map(cmd => prependName(this.command(cmd), cmd.name));
        return Object.assign({}, ...allPh);

        function prependName(ph, name) {
            const newPh = {};
            for(const [k, v] of Object.entries(ph)) newPh[`${name}_${k}`] = v;
            return newPh;
        }
    },
};

/**
 * Adds placeholders to a language key.
 * @template K
 * @param {K} key - The language key to add placeholders to.
 * @param {...object} placeholders - The placeholders to add.
 * @returns {K}
 */
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

            if(typeof string === 'object' && Array.isArray(replaced)) {
                replaced.push(addPh(string, placeholders));
                continue;
            }

            const match = string.match(/%.+%/g)?.shift();
            if(match) {
                /** @type {Object.<string, string> | Array<string>} */
                const placeholder = placeholders[match.replaceAll('%', '')];

                if(Array.isArray(placeholder)) {
                    for(const v of placeholder) {
                        if(!v.match(/%.+%/g) && Array.isArray(replaced)) replaced.push(v);
                    }
                }
                else if(typeof placeholder === 'object') {
                    replaced = {};
                    for(const [k, v] of Object.entries(placeholder)) replaced[k] = v;
                }
                else if(Array.isArray(replaced)) {
                    const v = placeholder ?? match;
                    replaced.push(v);
                }

                continue;
            }

            if(Array.isArray(replaced)) replaced.push(string);
        }

        return replaced;
    }
    else if(typeof key === 'object') {
        const replacedObject = {};

        for(const [k, v] of Object.entries(key)) {
            replacedObject[k] = addPh(v, placeholders);
        }

        return replacedObject;
    }
    else return key;
}

/**
 * Reply to an interaction with a translation key.
 * @param {BaseInteraction|Message} interaction - The interaction to reply to.
 * @param {string|MessagePayload|InteractionReplyOptions|WebhookEditMessageOptions|MessageReplyOptions} key - The translation key to reply with.
 * @param {...object} placeholders - The placeholders to replace in the translation key.
 * @returns {Promise<?Message|?InteractionResponse>}
 */
async function replyTl(interaction, key, ...placeholders) {
    // Log to console if interaction doesn't exist
    // noinspection JSUnresolvedVariable
    if(key?.console && !interaction) {
        console.log(addPh(key.console, Object.assign({}, ...placeholders)));
        return null;
    }

    if(!interaction || !key || !placeholders) {
        console.error(keys.api.messages.errors.no_reply_arguments.console);
        return null;
    }

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
        options.components = getActionRows(key, placeholders); //Add components message options
    }

    //Reply to interaction
    // noinspection JSUnresolvedVariable
    if(key.console) console.log(addPh(key.console, placeholders));

    if(!key.embeds && !key.components && !key.files) return null; //If only console don't reply
    return await replyOptions(interaction, options);
}

/**
 * Reply to an interaction with options.
 * @param {BaseInteraction|Message} interaction - The interaction to reply to.
 * @param {string|MessagePayload|InteractionReplyOptions|WebhookEditMessageOptions|MessageReplyOptions} options - The options to reply with.
 * @returns {Promise<Message>}
 */
async function replyOptions(interaction, options) {
    function handleError(err) {
        console.log(addPh(keys.api.messages.errors.could_not_reply.console, ph.error(err), { 'interaction': interaction }));
        try {
            return interaction.channel.send(options);
        }
        catch(err) {
            console.log(addPh(keys.api.messages.errors.could_not_reply_channel.console, ph.error(err), { 'interaction': interaction }));
        }
    }

    try {
        if(interaction instanceof Discord.Message) return await interaction.reply(options).catch(handleError);
        else if(interaction instanceof Discord.BaseInteraction) {
            if(!interaction.isRepliable()) return await interaction.message.reply(options).catch(handleError);
            if(interaction.deferred) return await interaction.editReply(options).catch(handleError);
            else return await interaction.reply(options).catch(handleError);
        }
    }
    catch(err) {
        handleError(err);
    }
}


/**
 * Get an embed builder from a language key.
 * @param {APIEmbed|{embeds: APIEmbed[]}} key - The language key to get the embed from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {?EmbedBuilder}
 */
function getEmbed(key, ...placeholders) {
    if(!key) return console.error(keys.api.messages.errors.no_embed_key.console);

    //Get first embed
    if(key.embeds) key = key.embeds[0];

    key = addPh(key, ...placeholders);

    const embed = new Discord.EmbedBuilder();

    for(const field of key.fields ?? []) {
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

/**
 * Get an action row builder from a language key.
 * @param {APIActionRowComponent} key - The language key to get the action row from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {ActionRowBuilder[]}
 */
function getActionRows(key, ...placeholders) {
    if(!key) {
        console.error(keys.api.messages.errors.no_component_key.console);
        return [];
    }

    const allComponents = key.components?.map(component => getComponent(component, ...placeholders))
        ?.filter(component => component !== undefined);

    return createActionRows(allComponents);
}

/**
 * Get a component builder from a language key.
 * @param {AnyComponent|{components: AnyComponent[]}} key - The language key to get the component builder from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {?ComponentBuilder}
 */
function getComponent(key, ...placeholders) {
    /** @type {AnyComponent} */
    let component = key;

    //Get first component
    if(key.components) component = key.components[0];

    if(!component.type) return;
    component = addPh(component, ...placeholders);

    let componentBuilder;
    switch(ComponentType[component.type]) {
        case ComponentType.Button:
            if(!component.style) return;

            componentBuilder = new Discord.ButtonBuilder()
                .setDisabled(component.disabled ?? false)
                .setStyle(Discord.ButtonStyle[component.style]);

            if(component.custom_id) componentBuilder.setCustomId(component.custom_id);
            if(component.emoji) componentBuilder.setEmoji(component.emoji);
            if(component.url) componentBuilder.setURL(component.url);
            if(component.label) componentBuilder.setLabel(component.label);

            break;
        case Discord.ComponentType.SelectMenu:
            if(!component.options || !component.custom_id) return;

            componentBuilder = new Discord.SelectMenuBuilder()
                .setCustomId(component.custom_id)
                .setDisabled(component.disabled ?? false);

            if(component.min_values) componentBuilder.setMinValues(component.min_values);
            if(component.max_values) componentBuilder.setMaxValues(component.max_values);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);

            for(const option of component.options ?? []) {
                if(!option.label || !option.value) return;

                const optionBuilder = new Discord.SelectMenuOptionBuilder()
                    .setLabel(option.label)
                    .setValue(option.value)
                    .setDefault(option.default ?? false);

                if(option.description) optionBuilder.setDescription(option.description);
                if(option.emoji) optionBuilder.setEmoji(option.emoji);

                componentBuilder.addOptions(optionBuilder);
            }

            break;
        case Discord.ComponentType.TextInput:
            if(!component.style || !component.custom_id || !component.label) return;

            componentBuilder = new Discord.TextInputBuilder()
                .setStyle(Discord.TextInputStyle[component.style])
                .setCustomId(component.custom_id)
                .setLabel(component.label)
                .setDisabled(component.disabled ?? false)
                .setRequired(component.required ?? false);

            if(component.max_length) componentBuilder.setMaxLength(component.max_length);
            if(component.min_length) componentBuilder.setMinLength(component.min_length);
            if(component.value) componentBuilder.setValue(component.value);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);
            if(component.label) componentBuilder.setLabel(component.label);

            break;
    }

    return componentBuilder;
}

/**
 * Get a command builder from a language key.
 * @param {APIApplicationCommand} key - The language key to get the command builder from.
 * @returns {?SlashCommandBuilder}
 */
function getCommand(key) {
    if(!key) return console.error(keys.api.messages.errors.no_command_key.console);
    if(!key.name || !key.type) return console.error(keys.api.messages.errors.no_command_arguments.console);

    let commandBuilder;
    switch(Discord.ApplicationCommandType[key.type]) {
        case Discord.ApplicationCommandType.ChatInput:
            if(!key.description) return;

            commandBuilder = new Discord.SlashCommandBuilder()
                .setName(key.name)
                .setDescription(key.description)
                .setDMPermission(key.dm_permission);

            if(key.default_member_permissions) {
                const permissionBits = new Discord.PermissionsBitField();
                for(const permission of key.default_member_permissions) {
                    permissionBits.add(Discord.PermissionFlagsBits[permission]);
                }

                commandBuilder.setDefaultMemberPermissions(permissionBits.bitfield);
            }


            for(const option of key.options) {
                addSlashCommandOption(commandBuilder, option);
            }

            break;
        case Discord.ApplicationCommandType.Message:
        case Discord.ApplicationCommandType.User:
            if(!key.description) return;

            commandBuilder = new Discord.ContextMenuCommandBuilder()
                .setName(key.name)
                .setType(Discord.ApplicationCommandType[key.type])
                .setDMPermission(key.dm_permission);

            if(key.default_member_permissions) {
                const permissionBits = new Discord.PermissionsBitField();
                for(const permission of key.default_member_permissions) {
                    permissionBits.add(Discord.PermissionFlagsBits[permission]);
                }

                commandBuilder.setDefaultMemberPermissions(permissionBits.bitfield);
            }

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

            for(const choice of key.choices ?? []) {
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

            for(const choice of key.choices ?? []) {
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

            for(const choice of key.choices ?? []) {
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

            for(const channelType of key.channel_types ?? []) {
                optionBuilder.addChannelTypes(Discord.ChannelType[channelType]);
            }

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

            for(const option of key.options ?? []) {
                addSlashCommandOption(optionBuilder, option);
            }

            optionBuilder = builder.addSubcommandGroup(optionBuilder);
            break;
        case Discord.ApplicationCommandOptionType.Subcommand:
            optionBuilder = new Discord.SlashCommandSubcommandBuilder();

            optionBuilder.setName(key.name)
                .setDescription(key.description);

            for(const option of key.options ?? []) {
                addSlashCommandOption(optionBuilder, option);
            }

            optionBuilder = builder.addSubcommand(optionBuilder);
            break;
    }
}

/**
 * Creates action rows from a list of components.
 * @param {ComponentBuilder[]} components - The components to create action rows from.
 * @returns {ActionRowBuilder[]}
 */
function createActionRows(components) {
    const actionRows = [];
    let currentRow = new Discord.ActionRowBuilder();

    for(let i = 0; i < components.length; i++) {
        //1 for select menus, 5 for buttons
        const componentAmount = components[i].data.type === Discord.ComponentType.SelectMenu ? 1 : 5;
        if(i % componentAmount === 0 && i > 0) {
            actionRows.push(currentRow);
            currentRow = new Discord.ActionRowBuilder();
        }

        currentRow.addComponents(components[i]);
    }
    if(currentRow.components.length > 0) actionRows.push(currentRow);

    return actionRows.length === 0 ? [currentRow] : actionRows;
}

module.exports = {
    ph,
    replyTl,
    replyOptions,
    addPh,
    getEmbed,
    getCommand,
    getActionRows,
    getComponent,
    createActionRows,
};