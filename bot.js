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
import keys, { getLanguageKey } from './api/keys.js';
import { addPh, addTranslatedResponses, ph } from './api/messages.js';
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

if(process.env.TOPGG_TOKEN) {
    const poster = AutoPoster(process.env.TOPGG_TOKEN, client);

    poster.on('posted', () => {});
    poster.on('error', () => console.log(getLanguageKey(keys.main.errors.could_not_post_stats.console)));
}

client.once(Discord.Events.ClientReady, async () => {
    console.log(addPh(
        keys.main.success.login.console,
        ph.client(client),
        { prefix: process.env.PREFIX, 'guild_count': client.guilds.cache.size },
    ));

    //Register minecraft font
    Canvas.FontLibrary.use('Minecraft', './resources/fonts/Minecraft.ttf');
});

client.on('allShardsReady', async () => {
    //Load all connections and commands
    await client.loadEverything();

    if(client.shard.ids.includes(0)) {
        //Start API server
        await client.api.startServer();
        //Set Activity
        client.user.setActivity({ type: Discord.ActivityType.Listening, name: '/help' });
    }
});

client.on(Discord.Events.GuildCreate, guild => {
    console.log(addPh(keys.main.success.guild_create.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
});

client.on(Discord.Events.GuildDelete, async guild => {
    if(!client.isReady() || !guild.available) return; //Prevent server outages from deleting data
    console.log(addPh(keys.main.success.guild_delete.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));

    await client.serverConnections.disconnect(guild.id);
    await client.serverSettingsConnections.disconnect(guild.id);
    await client.serverConnections.removeDataFolder(guild.id);
});

client.on(Discord.Events.MessageCreate, async message => {
    /** @type {ServerConnection} */
    const server = client.serverConnections.cache.get(message.guildId);

    if(!message.author.bot && !message.content.startsWith(process.env.PREFIX)) {
        /** @type {ChatChannelData} */
        const channel = server?.channels?.find(c => c.id === message.channel.id);
        //Explicit check for false
        //because it can be undefined (i haven't added the field to already existing connections)
        if(!channel || channel.allowDiscordToMinecraft === false) return;

        let content = cleanEmojis(message.cleanContent);
        message.attachments?.forEach(attach => content += ` \n [${attach.name}](${attach.url})`);

        //Fetch replied message if it exists
        const repliedMessage = message.type === Discord.MessageType.Reply ? await message.fetchReference() : null;
        let repliedContent = repliedMessage ? cleanEmojis(repliedMessage.cleanContent) : null;
        //If repliedContent is empty, it's probably an attachment
        if(repliedContent?.length === 0 && repliedMessage.attachments.size !== 0) {
            const firstAttach = repliedMessage.attachments.first();
            repliedContent = `[${firstAttach.name}](${firstAttach.url})`;
        }
        const repliedUser = repliedMessage ? repliedMessage.member?.nickname ?? message.author.username : null;
        // noinspection ES6MissingAwait
        server.protocol.chat(content, message.member?.nickname ?? message.author.username, repliedContent, repliedUser);
    }

    if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.replyTl(keys.main.success.ping);
    if(!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;

    message = addTranslatedResponses(message);

    //Make message compatible with slash commands
    message.user = message.author;

    //check if in guild
    if(!message.inGuild()) return message.replyTl(keys.main.no_access.not_in_guild);

    const args = message.content.slice(process.env.PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    /** @type {Command} */
    const command = client.commands.get(commandName);
    if(!command) return;
    if(!command.allowPrefix) return message.replyTl(keys.main.no_access.no_prefix_commands);

    try {
        // noinspection JSUnresolvedFunction
        await command.execute(message, client, args, server);
    }
    catch(err) {
        await message.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(message));
    }
});

client.on(Discord.Events.InteractionCreate, async interaction => {
    interaction = addTranslatedResponses(interaction);

    //check if in guild
    if(!interaction.guildId) return interaction.replyTl(keys.main.no_access.not_in_guild);

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
            await command.execute(interaction, client, args, server);
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
        }
        catch(err) {
            await console.log(addPh(keys.main.errors.could_not_autocomplete_command.console, ph.command(interaction.command), ph.error(err)));
        }
    }
    else if(interaction.isButton()) {
        let button = client.buttons.get(interaction.customId);
        if(!button) button = client.buttons.find(b => interaction.customId.startsWith(b.id));

        try {
            if(!button) return;
            // noinspection JSUnresolvedFunction
            await button.execute(interaction, client)
        }
        catch(err) {
            await interaction.replyTl(keys.main.errors.could_not_execute_button, ph.error(err), { 'button': interaction.customId });
        }
    }
});

await client.login(process.env.TOKEN);

export default client;
