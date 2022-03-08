const builders = require('@discordjs/builders');
const Discord = require('discord.js');
const keys = require('../languages/expanded/english.json');

function reply(message, key, ...placeholders) {
    if(!message || !key || !placeholders) return console.error('Could not reply: No message, key or placeholders specified');
    else if(!key.title || !key.description) return console.error('Could not reply: No title or description specified');

    placeholders = Object.assign(...placeholders);

    const keyEntries = Object.entries(key);
    key = {};

    //Add placeholders to all keyEntries recursively and assign them to key
    addPlaceholders(keyEntries, key);

    function addPlaceholders(entries, target) {
        for([k, v] of entries) {
            if(typeof v === 'object') {
                target[k] = {};
                addPlaceholders(Object.entries(v), target[k]);
            }
            if(typeof v !== 'string') continue;

            target[k] = v.replace(/%\w+%/g, match => {
                return placeholders[match.replaceAll('%', '')] ?? match;
            });
        }
    }

    //Create embed from key
    const embed = new Discord.MessageEmbed()
        .setTitle(key.title)
        .setDescription(key.description);

    if(key.fields) {
        key.fields.forEach(field => {
            if(field.title && field.content) embed.addField(field.title, field.content, field.inline);
        });
    }
    if(key.author) embed.setAuthor({ iconURL: key.author.icon_url, name: key.author.name, url: key.author.url });

    //Reply to interaction
    if(key.console) console.log(key.console);
    if(message instanceof Discord.Message || !message?.deferred) return message.reply({ embeds: [embed] });
    else return message.editReply({ embeds: [embed] });
}

module.exports = { keys, reply };