import Discord, {
    ActionRowBuilder,
    ApplicationCommand,
    BaseInteraction,
    Client,
    ComponentBuilder,
    ComponentType,
    EmbedBuilder,
    Guild,
    GuildApplicationCommandManager,
    InteractionResponse,
    Message,
    MessagePayload,
    ModalBuilder,
    SlashCommandBuilder,
    User,
} from 'discord.js';
import keys, { getLanguageKey, getObjectPath } from './keys.js';
import util from 'util';

const maxComponentsInActionRow = {
    [ComponentType.Button]: 5,
    [ComponentType.StringSelect]: 1,
    [ComponentType.RoleSelect]: 1,
    [ComponentType.ChannelSelect]: 1,
    [ComponentType.UserSelect]: 1,
    [ComponentType.MentionableSelect]: 1,
    [ComponentType.TextInput]: 1,
};

const completions = getLanguageKey(keys.completions);

/**
 * Adds methods that allow to respond with a translation key.
 * @template {BaseInteraction | Message} I
 * @param {I} interaction
 * @returns {I & TranslatedResponses}
 */
export function addTranslatedResponses(interaction) {
    interaction.replyTl = (key, ...placeholders) => replyTl(interaction, key, ...placeholders);
    interaction.replyOptions = options => replyOptions(interaction, options);
    return interaction;
}

/**
 * Default placeholders for discord.js structures.
 * @type {object}
 */
export const ph = {

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
            const args = interaction.content.slice(process.env.PREFIX.length).trim().split(/ +/);
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
        else if(interaction instanceof Discord.AutocompleteInteraction) {
            return {
                'interaction_name': interaction.commandName,
                'interaction_timestamp': Discord.time(new Date(interaction.createdTimestamp)),
            };
        }

        return {};
    },

    /**
     * Placeholders for a channel.
     * @param {Discord.Channel} channel - The channel to get placeholders for.
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
        const emojis = Object.entries(getLanguageKey(keys.emojis));
        const placeholders = {};

        emojis.forEach(([name, emoji]) => placeholders[`emoji_${name}`] = emoji);

        return placeholders;
    },

    /**
     * Color placeholders.
     * @returns {object}
     */
    colors() {
        const colors = Object.entries(getLanguageKey(keys.colors));
        const placeholders = {};

        colors.forEach(([name, color]) => placeholders[`color_${name}`] = color);

        return placeholders;
    },

    /**
     * Color and emoji placeholders.
     * @returns {object}
     */
    emojisAndColors() {
        return {
            ...ph.emojis(),
            ...ph.colors(),
        };
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
            'error': err,
            'error_name': err.name,
            'error_stack': err.stack ?? 'No stack trace.',
            'error_code': err.code ?? 'No error code.',
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
            this.author(interaction.member?.user ?? interaction.user),
            this.guild(interaction.guild),
            this.interaction(interaction),
            this.channel(interaction.channel),
            this.client(interaction.client),
            this.emojis(),
            this.colors(),
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

        const command = await fetchCommand(client.application.commands, commandName);
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

        const commands = await client.application.commands.fetch();

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
 * @param {...Object} placeholders - The placeholders to add.
 * @returns {K}
 */
export function addPh(key, ...placeholders) {
    if(util.types.isProxy(key)) key = getLanguageKey(key);
    placeholders = Object.assign({}, ...placeholders);

    if(typeof key === 'string') {
        key = key.replace(/%([^%]+)%/g, (match, name) => placeholders[name] ?? match);
        return key;
    }
    else if(Array.isArray(key)) {
        return key.map(item => addPh(item, placeholders));
    }
    else if(typeof key === 'object' && key !== null) {
        const result = {};
        for(const entry in key) {
            result[entry] = addPh(key[entry], placeholders);
        }
        return result;
    }
    else return key;
}

/**
 * Reply to an interaction with a translation key.
 * @param {BaseInteraction|Message} interaction - The interaction to reply to.
 * @param {string} key - The translation key to reply with.
 * @param {...object} placeholders - The placeholders to replace in the translation key.
 * @returns {Promise<?Message|?InteractionResponse>}
 */
export async function replyTl(interaction, key, ...placeholders) {
    const message = addCompletion(key);

    // Log to console if interaction doesn't exist
    // noinspection JSUnresolvedVariable
    if(message?.console && !interaction) {
        console.log(addPh(message.console, Object.assign({}, ...placeholders)));
        return null;
    }

    if(!interaction || !message || !placeholders) {
        console.error(getLanguageKey(keys.api.messages.errors.no_reply_arguments.console));
        return null;
    }

    placeholders = Object.assign({}, ph.std(interaction), ...placeholders);

    const options = getReplyOptions(message, placeholders);

    // noinspection JSUnresolvedVariable
    if(message.console) console.log(addPh(message.console, placeholders));

    if(!message.embeds && !message.components && !message.files) return null; //If only console don't reply
    return replyOptions(interaction, options);
}

/**
 * Reply to an interaction with options.
 * @param {BaseInteraction|Message} interaction - The interaction to reply to.
 * @param {string|MessagePayload|Discord.InteractionReplyOptions|Discord.MessageReplyOptions} options - The options to reply with.
 * @returns {Promise<Message>|Message}
 */
export async function replyOptions(interaction, options) {
    function handleError(err) {
        console.log(addPh(keys.api.messages.errors.could_not_reply.console, ph.error(err), { 'interaction': interaction }));
        try {
            return interaction.channel?.send(options);
        }
        catch(err) {
            console.log(addPh(keys.api.messages.errors.could_not_reply_channel.console, ph.error(err), { 'interaction': interaction }));
        }
    }

    try {
        if(interaction instanceof Discord.Message) return await interaction.reply(options).catch(handleError);
        else if(interaction instanceof Discord.BaseInteraction) {
            if(!interaction.isRepliable()) return await interaction.message.reply(options).catch(handleError);
            if(interaction.deferred || interaction.replied) return await interaction.editReply(options).catch(handleError);
            else return await interaction.reply(options).catch(handleError);
        }
    }
    catch(err) {
        handleError(err);
    }
}

/**
 * If the path's last or second to last element is contained in the `completions` array of the language file, merge the first embed with the completion.
 * @param {any} key - The language key to add the completion to.
 * @returns {Discord.BaseMessageOptions} - The message with the completion added.
 */
export function addCompletion(key) {
    const path = getObjectPath(key);
    const message = getLanguageKey(key);

    let completion;
    if(Object.keys(completions).includes(path[path.length - 1])) completion = completions[path[path.length - 1]];
    else if(Object.keys(completions).includes(path[path.length - 2])) completion = completions[path[path.length - 2]];

    if(completion && message.embeds?.[0]) message.embeds[0] = { ...completion, ...message.embeds[0] }; // original embeds is last, so it overrides the completion
    return message;
}

/**
 * Get an embed builder from a language key.
 * @param {Discord.APIEmbed|{embeds: Discord.APIEmbed[]}} key - The language key to get the embed from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {?EmbedBuilder}
 */
export function getEmbed(key, ...placeholders) {
    if(!key) {
        console.error(getLanguageKey(keys.api.messages.errors.no_embed_key.console));
        return null;
    }
    if(util.types.isProxy(key)) key = addCompletion(key);

    //Get first embed
    if(key.embeds) key = key.embeds[0];

    key = addPh(key, ...placeholders);

    const embed = new Discord.EmbedBuilder();

    for(const field of key.fields ?? []) {
        if(!field.name || !field.value) continue;
        embed.addFields({ name: field.name, value: field.value, inline: field.inline ?? false });
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
 * Get action row builders from a language key.
 * @param {Discord.APIActionRowComponent} key - The language key to get the action row from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {ActionRowBuilder[]}
 */
export function getActionRows(key, ...placeholders) {
    if(!key) {
        console.error(getLanguageKey(keys.api.messages.errors.no_component_key.console));
        return [];
    }
    if(util.types.isProxy(key)) key = getLanguageKey(key);

    const allComponents = key.components
        ?.map(component => getComponent(component, ...placeholders))
        ?.filter(component => component);

    return createActionRows(allComponents);
}

/**
 * Get a component builder from a language key.
 * @param {Discord.AnyComponent|{components: Discord.AnyComponent[]}} key - The language key to get the component builder from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {?ComponentBuilder}
 */
export function getComponent(key, ...placeholders) {
    if(!key) {
        console.error(getLanguageKey(keys.api.messages.errors.no_component_key.console));
        return null;
    }
    if(util.types.isProxy(key)) key = getLanguageKey(key);

    /** @type {Discord.AnyComponent} */
    let component = key;

    //Get first component
    if(key.components) component = key.components[0];

    if(!component.type) return null;
    component = addPh(component, ...placeholders);

    let componentBuilder;
    switch(ComponentType[component.type]) {
        case ComponentType.Button:
            if(!component.style) return null;

            componentBuilder = new Discord.ButtonBuilder()
                .setDisabled(component.disabled ?? false)
                .setStyle(Discord.ButtonStyle[component.style]);

            if(component.custom_id) componentBuilder.setCustomId(component.custom_id);
            if(component.emoji) componentBuilder.setEmoji(component.emoji);
            if(component.url) componentBuilder.setURL(component.url);
            if(component.label) componentBuilder.setLabel(component.label);

            break;
        case Discord.ComponentType.StringSelect:
            if(!component.options || !component.custom_id) return null;

            componentBuilder = new Discord.StringSelectMenuBuilder()
                .setCustomId(component.custom_id)
                .setDisabled(component.disabled ?? false);

            // Prevent 0 from being interpreted as false
            if(typeof component.min_values === 'number') componentBuilder.setMinValues(component.min_values);
            if(component.max_values) componentBuilder.setMaxValues(component.max_values);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);

            for(const option of component.options ?? []) {
                if(!option.label || !option.value) return null;

                const optionBuilder = new Discord.StringSelectMenuOptionBuilder()
                    .setLabel(option.label)
                    .setValue(option.value)
                    .setDefault(option.default ?? false);

                if(option.description) optionBuilder.setDescription(option.description);
                if(option.emoji) optionBuilder.setEmoji(option.emoji);

                componentBuilder.addOptions(optionBuilder);
            }

            break;
        case Discord.ComponentType.RoleSelect:
            if(!component.custom_id) return null;

            componentBuilder = new Discord.RoleSelectMenuBuilder()
                .setCustomId(component.custom_id)
                .setDisabled(component.disabled ?? false);

            if(typeof component.min_values === 'number') componentBuilder.setMinValues(component.min_values);
            if(component.max_values) componentBuilder.setMaxValues(component.max_values);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);
            if(component.default_values) componentBuilder.setDefaultRoles(component.default_values.map(value => value.id));

            break;
        case Discord.ComponentType.ChannelSelect:
            if(!component.custom_id) return null;

            componentBuilder = new Discord.ChannelSelectMenuBuilder()
                .setCustomId(component.custom_id)
                .setDisabled(component.disabled ?? false);

            if(typeof component.min_values === 'number') componentBuilder.setMinValues(component.min_values);
            if(component.max_values) componentBuilder.setMaxValues(component.max_values);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);
            if(component.default_values) componentBuilder.setDefaultChannels(component.default_values.map(value => value.id));

            break;
        case Discord.ComponentType.UserSelect:
            if(!component.custom_id) return null;

            componentBuilder = new Discord.UserSelectMenuBuilder()
                .setCustomId(component.custom_id)
                .setDisabled(component.disabled ?? false);

            if(typeof component.min_values === 'number') componentBuilder.setMinValues(component.min_values);
            if(component.max_values) componentBuilder.setMaxValues(component.max_values);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);
            if(component.default_values) componentBuilder.setDefaultUsers(component.default_values.map(value => value.id));

            break;
        case Discord.ComponentType.MentionableSelect:
            if(!component.custom_id) return null;

            componentBuilder = new Discord.MentionableSelectMenuBuilder()
                .setCustomId(component.custom_id)
                .setDisabled(component.disabled ?? false);

            if(typeof component.min_values === 'number') componentBuilder.setMinValues(component.min_values);
            if(component.max_values) componentBuilder.setMaxValues(component.max_values);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);
            if(component.default_values) componentBuilder.setDefaultValues(component.default_values);

            break;
        case Discord.ComponentType.TextInput:
            if(!component.style || !component.custom_id || !component.label) return null;

            componentBuilder = new Discord.TextInputBuilder()
                .setStyle(Discord.TextInputStyle[component.style])
                .setCustomId(component.custom_id)
                .setLabel(component.label)
                .setRequired(component.required ?? false);

            if(component.max_length) componentBuilder.setMaxLength(component.max_length);
            if(typeof component.min_length === 'number') componentBuilder.setMinLength(component.min_length);
            if(component.value) componentBuilder.setValue(component.value);
            if(component.placeholder) componentBuilder.setPlaceholder(component.placeholder);
            if(component.label) componentBuilder.setLabel(component.label);

            break;
    }

    return componentBuilder;
}

/**
 * Get discord reply options from a language key.
 * @param {Discord.MessageReplyOptions|Discord.InteractionReplyOptions} key - The language key to get the reply options from.
 * @param {object} placeholders - The placeholders to replace in the language key.
 * @returns {?Discord.MessageReplyOptions|?Discord.InteractionReplyOptions}
 */
export function getReplyOptions(key, ...placeholders) {
    if(!key) {
        console.error(getLanguageKey(keys.api.messages.errors.no_reply_key.console));
        return null;
    }
    if(util.types.isProxy(key)) key = addCompletion(key);

    const options = { ...addPh(key, ...placeholders) };
    if(key.embeds) options.embeds = key.embeds.map(embed => getEmbed(embed, ...placeholders));
    if(key.components) options.components = getActionRows(key, ...placeholders);
    if(key.color) options.color = Discord.resolveColor(options.color);

    return options;
}

/**
 * Get a command builder from a language key.
 * @param {Discord.APIApplicationCommand} key - The language key to get the command builder from.
 * @returns {?SlashCommandBuilder}
 */
export function getCommand(key) {
    if(!key) {
        console.error(getLanguageKey(keys.api.messages.errors.no_command_key.console));
        return null;
    }
    if(util.types.isProxy(key)) key = getLanguageKey(key);

    if(!key.name || !key.type) {
        console.error(getLanguageKey(keys.api.messages.errors.no_command_arguments.console));
        return null;
    }

    let commandBuilder;
    switch(Discord.ApplicationCommandType[key.type]) {
        case Discord.ApplicationCommandType.ChatInput:
            if(!key.description) return null;

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


            for(const option of key.options ?? []) {
                addSlashCommandOption(commandBuilder, option);
            }

            break;
        case Discord.ApplicationCommandType.Message:
        case Discord.ApplicationCommandType.User:
            if(!key.description) return null;

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

/**
 * Get a modal builder from a language key.
 * @param {Discord.APIModalInteractionResponseCallbackData} key - The language key to get the modal builder from.
 * @param {...object} placeholders - The placeholders to replace in the language key.
 * @returns {?ModalBuilder}
 */
export function getModal(key, ...placeholders) {
    if(!key) {
        console.error(getLanguageKey(keys.api.messages.errors.no_component_key.console));
        return null;
    }
    if(util.types.isProxy(key)) key = getLanguageKey(key);

    key = addPh(key, ...placeholders);

    const modalBuilder = new Discord.ModalBuilder()
        .setTitle(key.title)
        .setCustomId(key.custom_id);

    modalBuilder.setComponents(getActionRows(key, ...placeholders));
    return modalBuilder;
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
            if(typeof key.min_length === 'number') optionBuilder.setMinLength(key.min_length);

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

            if(typeof key.min_value === 'number') optionBuilder.setMinValue(key.min_value);
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

            if(typeof key.min_value === 'number') optionBuilder.setMinValue(key.min_value);
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
export function createActionRows(components) {
    if(!components || components.length === 0) return [];

    const actionRows = [];
    let currentRow = new Discord.ActionRowBuilder();

    for(const component of components) {
        currentRow.addComponents(component);

        const maxAmount = maxComponentsInActionRow[component.data.type];

        //If the same component type is already in the row more than the max amount, create a new row.
        if(currentRow.components.filter(c => c.data.type === component.data.type).length >= maxAmount) {
            actionRows.push(currentRow);
            currentRow = new Discord.ActionRowBuilder();
        }
    }
    if(currentRow.components.length > 0) actionRows.push(currentRow);

    return actionRows.length === 0 ? [currentRow] : actionRows;
}

/**
 * Fetches a slash command from the given manager by its name.
 * @param {GuildApplicationCommandManager|ApplicationCommandManager} commandManager - The command manager to search in.
 * @param {string} name - The name of the command to search for.
 * @returns {Promise<ApplicationCommand>}
 */
export async function fetchCommand(commandManager, name) {
    const slashCommand = commandManager.cache.find(cmd => cmd.name === name);
    if(!slashCommand) {
        const commands = await commandManager.fetch();
        return commands.find(cmd => cmd.name === name);
    }
    return slashCommand;
}
