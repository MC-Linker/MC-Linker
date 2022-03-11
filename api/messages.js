const builders = require('@discordjs/builders');
const Discord = require('discord.js');
const keys = require('../languages/expanded/english.json');
const { prefix } = require('../config.json');

const ph = {};
ph.fromUser = function(user) {
    if(!user instanceof Discord.User) return {};

    return {
        "author_name": user.name,
        "author_tag": user.tag,
        "author_id": user.id,
        "author_timestamp": builders.time(new Date(user.createdTimestamp)),
    }
}
ph.fromGuild = function(guild) {
    if(!guild instanceof Discord.Guild) return {};

    return {
        "guild_name": guild.name,
        "guild_id": guild.id,
        "guild_member_count": guild.memberCount,
        "guild_timestamp": builders.time(new Date(guild.createdTimestamp)),
    }
}
ph.fromMessage = function(message) {
    if(message instanceof Discord.Message) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        return {
            "command_name": commandName,
            "command_timestamp": builders.time(new Date(message.createdTimestamp)),
            "args": args.join(' '),
        }
    } else if(message instanceof Discord.CommandInteraction) {
        return {
            "command_name": message.commandName,
            "command_timestamp": builders.time(new Date(message.createdTimestamp)),
            "args": getArgs(message).join(' '),
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
    }
}

ph.fromAll = function(user, guild, channel, interaction) {
    return Object.assign(
        this.fromUser(user),
        this.fromGuild(guild),
        this.fromMessage(interaction),
        this.fromChannel(channel)
    );
}


function addPlaceholders(key, placeholders) {
    if(typeof key === 'string') {
        return string.replace(/%\w+%/g, match => {
            return placeholders[match.replaceAll('%', '')] ?? match;
        });
    } else if(typeof key !== 'object') return;

    const entries = Object.entries(key);
    const replacedObject = {};

    for([k, v] of entries) {
        if(typeof v === 'object') {
            replacedObject[k] = addPlaceholdersToObject(Object.entries(v), placeholders);
        }
        if(typeof v !== 'string') continue;

        replacedObject[k] = v.replace(/%\w+%/g, match => {
            return placeholders[match.replaceAll('%', '')] ?? match;
        });
    }

    return replacedObject;
}

function reply(message, key, ...placeholders) {
    if(!message || !key || !placeholders) return console.error('Could not reply: No message, key or placeholders specified');
    else if(!key.title || !key.description) return console.error('Could not reply: No title or description specified');

    placeholders = Object.assign(...placeholders);

    //Add placeholders to all keyEntries recursively and assign them to key
    const replacedKey = addPlaceholders(key, placeholders);

    //Create embed from key
    const embed = new Discord.MessageEmbed()
        .setTitle(replacedKey.title)
        .setDescription(replacedKey.description);

    if(replacedKey.fields) {
        replacedKey.fields.forEach(field => {
            if(field.title && field.content) embed.addField(field.title, field.content, field.inline);
        });
    }
    if(replacedKey.author) embed.setAuthor({ iconURL: replacedKey.author.icon_url, name: replacedKey.author.name, url: replacedKey.author.url });

    //Reply to interaction
    if(replacedKey.console) console.log(replacedKey.console);
    if(message instanceof Discord.Message || !message?.deferred) return message.reply({ embeds: [embed] });
    else return message.editReply({ embeds: [embed] });
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

module.exports = { keys, ph, reply, addPlaceholders, getArgs };