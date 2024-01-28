import Discord, { ChannelType } from 'discord.js';
import { AutoPoster } from 'topgg-autoposter';
import Canvas from 'skia-canvas';
import { cleanEmojis, getArgs } from './utilities/utils.js';
import keys, { getLanguageKey } from './utilities/keys.js';
import { addPh, addTranslatedResponses, getReplyOptions, ph } from './utilities/messages.js';
import AutocompleteCommand from './structures/AutocompleteCommand.js';
import MCLinker from './structures/MCLinker.js';

console.log(
    '\x1b[1m' +     // Bold (1)
    '\x1b[44;37m' + // Blue BG (44); White FG (37)
    '%s' +          // Insert second argument
    '\x1b[0m',      // Reset color (0)
    'Loading...',   // Second argument (%s)
);

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
    //Load all connections and commands and the database
    await client.loadEverything();

    //Set Activity
    client.user.setActivity({type: Discord.ActivityType.Listening, name: '/help'});

    //Start API server if this is the first shard
    if (client.shard.ids.includes(0)) await client.api.startServer();
});

client.on(Discord.Events.GuildCreate, async guild => {
    console.log(addPh(keys.main.success.guild_create.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
    await sendToServer(guild, keys.main.success.invite, ph.emojisAndColors());
});

client.on(Discord.Events.GuildDelete, async guild => {
    if(!client.isReady() || !guild.available) return; //Prevent server outages from deleting data
    console.log(addPh(keys.main.success.guild_delete.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));

    await client.serverConnections.disconnect(guild.id);
    await client.serverSettingsConnections.disconnect(guild.id);
    await client.serverConnections.removeCache(guild.id);
});

client.on(Discord.Events.MessageCreate, async message => {
    if(message.author.bot) return;

    //check if in guild
    message = addTranslatedResponses(message);

    if(!message.inGuild()) {
        if(client.api.usersAwaitingVerification.has(message.content)) {
            const { username, uuid } = client.api.usersAwaitingVerification.get(message.content);

            await client.userConnections.connect({
                id: message.author.id,
                username,
                uuid,
            });

            client.api.usersAwaitingVerification.delete(message.content);
            return await message.replyTl(keys.commands.account.success.verified);
        }
    }

    /** @type {ServerConnection} */
    const server = client.serverConnections.cache.get(message.guildId);

    if(!message.content.startsWith(process.env.PREFIX)) {
        /** @type {ChatChannelData} */
        const channel = server?.chatChannels?.find(c => c.id === message.channel.id);
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

    if(!message.inGuild()) return message.replyTl(keys.main.no_access.not_in_guild);

    //Make message compatible with slash commands
    message.user = message.author;

    const args = message.content.slice(process.env.PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    /** @type {Command} */
    const command = client.commands.get(commandName);
    if(!command) return;
    if(!command.allowPrefix) return message.replyTl(keys.main.no_access.no_prefix_commands);

    try {
        // noinspection JSUnresolvedFunction
        await command.execute(message, client, args, server);
    } catch (err) {
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
            else if (arg instanceof Discord.BaseChannel) interaction.mentions.channels.set(arg.id, arg);
            else if (arg instanceof Discord.Attachment) interaction.attachments.set(arg.id, arg);
        });

        const server = client.serverConnections.cache.get(interaction.guildId);
        try {
            // noinspection JSUnresolvedFunction
            await command.execute(interaction, client, args, server);
        } catch (err) {
            await interaction.replyTl(keys.main.errors.could_not_execute_command, ph.error(err), ph.interaction(interaction));
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        try {
            if (!command || !(command instanceof AutocompleteCommand)) return;
            await command.autocomplete(interaction, client);
        } catch (err) {
            await console.log(addPh(keys.main.errors.could_not_autocomplete_command.console, ph.interaction(interaction), ph.error(err)));
        }
    } else if (interaction.isButton()) {
        let button = client.buttons.get(interaction.customId);
        if (!button) button = client.buttons.find(b => interaction.customId.startsWith(b.id));

        try {
            if (!button) return;
            // noinspection JSUnresolvedFunction
            await button.execute(interaction, client);
        } catch (err) {
            await interaction.replyTl(keys.main.errors.could_not_execute_button, ph.error(err), {'button': interaction.customId});
        }
    }
});

client.on(Discord.Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if(!oldMember.roles) return; //Prevent errors from oldMember being a partial
    if(oldMember.roles.cache.size === newMember.roles.cache.size) return;

    /** @type {ServerConnection} */
    const server = client.serverConnections.cache.get(newMember.guild.id);
    if(!server || !server.protocol.isPluginProtocol()) return;

    /** @type {UserConnection} */
    const user = client.userConnections.cache.get(newMember.id);
    if(!user) return;

    const addedRole = newMember.roles.cache.find(role => !oldMember.roles.cache.has(role.id));
    const removedRole = oldMember.roles.cache.find(role => !newMember.roles.cache.has(role.id));
    if(server.requiredRoleToJoin) {
        if(
            server.requiredRoleToJoin.method === 'any' && !server.requiredRoleToJoin.roles.some(id => newMember.roles.cache.has(id)) ||
            server.requiredRoleToJoin.method === 'all' && !server.requiredRoleToJoin.roles.every(id => newMember.roles.cache.has(id))
        ) await server.protocol.execute(`kick ${user.username} §cYou do not have the required role to join this server`);
    }

    const role = server.syncedRoles?.find(role => role.id === addedRole?.id || role.id === removedRole?.id);
    if(!role) return;

    let resp;
    if(addedRole) resp = await server.protocol.addSyncedRoleMember(role, user.uuid);
    if(removedRole) resp = await server.protocol.removeSyncedRoleMember(role, user.uuid);

    const roleIndex = server.syncedRoles.findIndex(r => r.id === role.id);
    if(roleIndex === -1) return;

    //Update players of role
    role.players = resp.data;
    server.syncedRoles[roleIndex] = role;

    //Update server
    if(resp.status === 200) await server.edit({});
});

/**
 * Send a message to a guild with the given key
 * This will try to send the message to the system channel first
 * If that fails, it will try to send it to the public updates channel
 * If that also fails, it will try to send it to the first text channel it finds
 * @param {Discord.Guild} guild - The guild to send the message to
 * @param {any} key - The key of the message to send
 * @param {...Object} placeholders - The placeholders to use in the message
 * @returns {Promise<void>}
 */
async function sendToServer(guild, key, ...placeholders) {
    const replyOptions = getReplyOptions(key, ...placeholders);

    if(await trySendMessage(guild.systemChannel)) return;
    if(await trySendMessage(guild.publicUpdatesChannel)) return;

    const sortedChannels = await sortChannels(guild);
    for(const channel of sortedChannels) {
        if(await trySendMessage(channel)) return;
    }

    async function trySendMessage(channel) {
        if(!channel || !channel.isTextBased()) return false;
        try {
            await channel.send(replyOptions);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Sort channels in a guild by their position
 * @param {Guild} guild - The guild to sort the channels in
 * @returns {Promise<Discord.Channel[]>}
 */
async function sortChannels(guild) {
    const guildChannels = await guild.channels.fetch();

    //Sorting by type (text over voice) and by position
    const descendingPosition = (a, b) => {
        if(a.type === b.type) return a.position - b.position;
        else if(a.type === 'voice') return 1;
        else return -1;
    };

    const sortedChannels = [];

    /** @type {Discord.Collection<?Discord.CategoryChannel, Discord.Collection<Discord.Snowflake, Discord.CategoryChildChannel>>} */
    const channels = new Discord.Collection();

    //Push channels without category/parent
    guildChannels
        .filter(channel => !channel.parent && channel.type !== ChannelType.GuildCategory)
        .sort(descendingPosition)
        .forEach(c => sortedChannels.push(c));

    //Set Categories with their children
    /** @type {Discord.Collection<Discord.Snowflake, Discord.CategoryChannel>} */
    const categories = guildChannels.filter(channel => channel.type === ChannelType.GuildCategory).sort(descendingPosition);
    categories.forEach(category => channels.set(category, category.children.cache.sort(descendingPosition)));

    //Loop over all categories
    channels.forEach((children, category) => {
        //Push category
        if(category) sortedChannels.push(category);

        //Loop over children of categories and push children
        for(const [_, child] of children) sortedChannels.push(child);
    });

    return sortedChannels;
}

await client.login(process.env.TOKEN);

export default client;
