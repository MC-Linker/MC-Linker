console.log(
    '\x1b[1m' +     // Bold (1)
    '\x1b[44;37m' + // Blue BG (44); White FG (37)
    '%s' +          // Insert second argument
    '\x1b[0m',      // Reset color (0)
    'Loading...',   // Second argument (%s)
);

import Discord from 'discord.js';
import { AutoPoster } from 'topgg-autoposter';
import Canvas from 'skia-canvas';
import { cleanEmojis, getArgs } from './api/utils.js';
import keys from './api/keys.js';
import { addPh, addTranslatedResponses, ph } from './api/messages.js';
import config from './config.json' assert { type: 'json' };
import AutocompleteCommand from './structures/AutocompleteCommand.js';
import MCLinker from './structures/MCLinker.js';

const client = new MCLinker();

//Handle errors
process.on('unhandledRejection', async err => {
    console.log(addPh(keys.main.errors.unknown_rejection.console, ph.error(err)));
});
process.on('uncaughtException', async err => {
    console.log(addPh(keys.main.errors.unknown_rejection.console, ph.error(err)));
});

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} - The formatted string.
 */
String.prototype.cap = function() {
    return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase();
};

if(config.topggToken) {
    const poster = AutoPoster(config.topggToken, client);

    poster.on('posted', () => {});
    poster.on('error', () => console.log(keys.main.errors.could_not_post_stats.console));
}

client.once('ready', async () => {
    console.log(addPh(
        keys.main.success.login.console,
        ph.client(client),
        { prefix: config.prefix, 'guild_count': client.guilds.cache.size },
    ));

    //Set Activity
    client.user.setActivity({ type: Discord.ActivityType.Listening, name: '/help' });

    //Load all connections and commands
    await client.loadEverything();

    //Start API server
    await client.api.startServer();

    //Register minecraft font
    Canvas.FontLibrary.use('Minecraft', './resources/fonts/Minecraft.ttf');
});

client.on('guildCreate', guild => {
    console.log(addPh(keys.main.success.guild_create.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
});

client.on('guildDelete', async guild => {
    if(!client.isReady() || !guild.available) return; //Prevent server outages from deleting data
    console.log(addPh(keys.main.success.guild_delete.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));

    await client.serverConnections.disconnect(guild.id);
    await client.serverSettingsConnections.disconnect(guild.id);
    await client.serverConnections.removeDataFolder(guild.id);
});

client.on('messageCreate', async message => {
    /** @type {ServerConnection} */
    const server = client.serverConnections.cache.get(message.guildId);
    if(!message.author.bot && server?.channels?.some(c => c.id === message.channel.id) && !message.content.startsWith(config.prefix)) {
        let content = message.cleanContent;
        content = cleanEmojis(content);
        message.attachments?.forEach(attach => content += ` \n [${attach.name}](${attach.url})`);
        server.protocol.chat(content, message.member.nickname ?? message.author.username);
    }

    message = addTranslatedResponses(message);
    //Make message compatible with slash commands
    message.user = message.author;

    if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.replyTl(keys.main.success.ping);
    if(!message.content.startsWith(config.prefix) || message.author.bot) return;

    //check if in guild
    if(!message.inGuild()) return message.replyTl(keys.main.warnings.not_in_guild);

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if(!command) return;

    try {
        // noinspection JSUnresolvedFunction
        await command.execute(message, client, args, server)
            ?.catch(err => message.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(message)));
    }
    catch(err) {
        await message.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(message));
    }
});

client.on('interactionCreate', async interaction => {
    interaction = addTranslatedResponses(interaction);

    //check if in guild
    if(!interaction.guildId) return interaction.replyTl(keys.main.warnings.not_in_guild);

    if(interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        //Making interaction compatible with prefix commands
        interaction.mentions = {
            users: new Discord.Collection(),
            roles: new Discord.Collection(),
            channels: new Discord.Collection(),
        };
        interaction.attachments = new Discord.Collection();


        const args = await getArgs(interaction);
        //Add mentions and attachments from args
        args.forEach(arg => {
            if(arg instanceof Discord.User) interaction.mentions.users.set(arg.id, arg);
            else if(arg instanceof Discord.Role) interaction.mentions.roles.set(arg.id, arg);
            else if(arg instanceof Discord.BaseChannel) interaction.mentions.channels.set(arg.id, arg);
            else if(arg instanceof Discord.Attachment) interaction.attachments.set(arg.id, arg);
        });

        const server = client.serverConnections.cache.get(interaction.guildId);
        try {
            // noinspection JSUnresolvedFunction
            await command.execute(interaction, client, args, server)
                ?.catch(err => interaction.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(interaction)));
        }
        catch(err) {
            await interaction.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(interaction));
        }
    }
    else if(interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        try {
            if(!command || !(command instanceof AutocompleteCommand)) return;
            await command.autocomplete(interaction, client)
                ?.catch(err => console.log(addPh(keys.main.errors.could_not_autocomplete_command.console, ph.error(err), ph.interaction(interaction))));
        }
        catch(err) {
            await console.log(addPh(keys.main.errors.could_not_autocomplete_command.console, ph.error(err), ph.interaction(interaction)));
        }
    }
    else if(interaction.isButton()) {
        let button = client.buttons.get(interaction.customId);
        if(!button) button = client.buttons.find(b => interaction.customId.startsWith(b.id));

        try {
            if(!button) return;
            // noinspection JSUnresolvedFunction
            await button.execute(interaction, client)
                ?.catch(err => interaction.replyTl(keys.main.errors.could_not_execute_button, ph.error(err), { 'button': interaction.customId }));
        }
        catch(err) {
            await interaction.replyTl(keys.main.errors.could_not_execute_button, ph.error(err), { 'button': interaction.customId });
        }
    }
});

client.login(config.token);
