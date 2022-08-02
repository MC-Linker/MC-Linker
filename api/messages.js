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
ph.author = function(author) {
    if(!(author instanceof Discord.User)) return {};

    return {
        "author_username": author.username,
        "author_tag": author.tag,
        "author_id": author.id,
        "author_avatar": author.displayAvatarURL({ extension: Discord.ImageFormat.PNG }),
        "author_timestamp": Discord.time(new Date(author.createdTimestamp)),
    }
};
ph.guild = function(guild) {
    if(!(guild instanceof Discord.Guild)) return {};

    return {
        "guild_name": guild.name,
        "guild_id": guild.id,
        "guild_member_count": guild.memberCount,
        "guild_timestamp": Discord.time(new Date(guild.createdTimestamp)),
    }
};
ph.interaction = function(interaction) {
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
ph.channel = function(channel) {
    if(!(channel instanceof Discord.TextChannel)) return {};

    return {
        "channel_name": channel.name,
        "channel_description": channel.topic,
        "channel_id": channel.id,
        "channel_timestamp": Discord.time(new Date(channel.createdTimestamp)),
    }
};
ph.client = function(client) {
    if(!(client instanceof Discord.Client)) return {};

    return {
        "client_username": client.user.username,
        "client_tag": client.user.tag,
        "client_id": client.user.id,
        "client_avatar": client.user.displayAvatarURL({ extension: Discord.ImageFormat.PNG }),
        "client_timestamp": Discord.time(new Date(client.user.createdTimestamp)),
    }
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
        "command_mention": `</${command.name}:${command.id}>`,
        "command_name": command.name,
        "command_id": command.id,
        "command_short_description": command.description,
        "command_timestamp": Discord.time(new Date(command.createdTimestamp)),
    }
};

ph.error = function(err) {
    if(!(err instanceof Error)) return {};

    return {
        "error": err.stack,
        "error_message": err.message,
    }
};

ph.std = function(interaction) {
    if(!(interaction instanceof Discord.BaseInteraction || !(interaction instanceof Discord.Message))) return {};

    return Object.assign(
        this.author(interaction.user),
        this.guild(interaction.guild),
        this.interaction(interaction),
        this.channel(interaction.channel),
        this.client(interaction.client),
        this.emojis(),
        { "timestamp_now": Discord.time(Date.now()/1000) }
    );
};

ph.commandName = async function(commandName, clientOrGuild) {
    let commands;
    if(clientOrGuild instanceof Discord.Guild) {
        commands = await clientOrGuild.commands.fetch();
    } else if(clientOrGuild instanceof Discord.Client) {
        commands = await clientOrGuild.application.commands.fetch();
    }

    const command = commands.find(cmd => cmd.name === commandName);

    if(!(command instanceof Discord.ApplicationCommand)) return {};

    return this.command(command);
};

ph.allCommands = async function (clientOrGuild) {
    let commands;
    if (clientOrGuild instanceof Discord.Guild) {
        commands = await clientOrGuild.commands.fetch();
    } else if (clientOrGuild instanceof Discord.Client) {
        commands = await clientOrGuild.application.commands.fetch();
    }

    const allPh = commands.map(cmd => prependName(this.command(cmd), cmd.name));

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
        let replaced = [];

        for(let i=0; i<key.length; i++) {
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
                } else if(typeof placeholder === 'object') {
                    for([k, v] of Object.entries(placeholder)) replaced[k] = v;
                } else {
                    const v = placeholder ?? match;
                    replaced.push(v);
                }

                continue;
            }

            replaced.push(string);
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
    //Only log to console if interaction doesn't exist
    if(key?.console && !interaction) return console.log(addPh(key.console, Object.assign({}, ...placeholders)));

    if(!interaction || !key || !placeholders) return console.error(keys.api.messages.errors.no_reply_arguments.console);

    placeholders = Object.assign(
        ph.std(interaction),
        ...placeholders
    );

    key = addPh(key, placeholders);

    //Reply to interaction
    if(key.console) console.log(addPh(key.console, placeholders));

    if(!key.embeds) return; //If only console don't reply
    return replyOptions(interaction, key);
}

function replyOptions(interaction, options) {
    function handleError(err) {
        console.log(addPh(keys.api.messages.errors.could_not_reply.console, ph.error(err), { "interaction": interaction }));
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
        if(option.type === Discord.ApplicationCommandOptionType.SubcommandGroup || option.type === Discord.ApplicationCommandOptionType.Subcommand) {
            args.push(option.name);
            option.options.forEach(opt => addArgs(opt));
        }
        else if(option.type === Discord.ApplicationCommandOptionType.User && option.name === 'user')
            args.push(getUsersFromMention(client, option.value)?.[0] ?? option.value);
        else if(option.type === Discord.ApplicationCommandOptionType.Channel) args.push(option.channel);
        else if(option.type === Discord.ApplicationCommandOptionType.Role) args.push(option.role);
        else if(option.type === Discord.ApplicationCommandOptionType.Attachment) args.push(option.attachment);
        else args.push(option.value);
    }

    interaction.options.data.forEach(option => addArgs(option));

    return args;
}

module.exports = { keys, ph, reply, replyOptions, addResponseMethods, addPh, defaultMessage, getUsersFromMention, getArgs };