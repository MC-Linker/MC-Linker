import Discord, {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ChannelType,
    CommandInteraction,
    GuildChannel,
    MessageMentions,
    PermissionFlagsBits,
    Routes,
} from 'discord.js';
import { getReplyOptions } from './messages.js';
import fs from 'fs-extra';
import path from 'path';
import rootLogger from './logger/Logger.js';
import features from './logger/features.js';
import { trackError } from '../structures/analytics/AnalyticsCollector.js';

const logger = rootLogger.child({ feature: features.utilities.utils });

/**
 * Searches for a guild member by username/display name and only returns exact matches.
 * @param {import('discord.js').Guild} guild - The guild to search in.
 * @param {string} user - The username/display name to look up.
 * @returns {Promise<?import('discord.js').GuildMember>} - The matching guild member or null.
 */
export async function findMemberByUsername(guild, user) {
    const search = user.toLowerCase();
    const foundMember = (await guild.members.search({ query: search, limit: 1 }))?.first();
    if(!foundMember) return null;

    if(
        foundMember.user.displayName.toLowerCase() !== search &&
        foundMember.displayName.toLowerCase() !== search &&
        foundMember.user.username.toLowerCase() !== search
    ) return null;

    return foundMember;
}

/**
 * Parses `@username` mentions in a message string and replaces them with Discord member mentions.
 * Only exact matches against display name, nickname, or username are replaced.
 * @param {string} message - The raw message text potentially containing `@username` mentions.
 * @param {import('discord.js').Guild} guild - The guild to search for members in.
 * @returns {Promise<string>} The message with matched mentions replaced by Discord mention strings.
 */
export async function parseMentions(message, guild) {
    let parsedMessage = message;
    const mentions = parsedMessage.match(/@(\S+)/g);
    for(const mention of mentions ?? []) {
        if(mention.length > 101) continue;

        const search = mention.replace('@', '').toLowerCase();
        const foundMember = await findMemberByUsername(guild, search).catch(() => null);
        if(!foundMember) continue;

        parsedMessage = parsedMessage.replace(mention, foundMember.toString());
    }

    return parsedMessage;
}

/**
 * Gets an array of arguments from a CommandInteraction.
 * @param {CommandInteraction} interaction - The interaction to get the arguments from.
 * @returns {Promise<string[]>|string[]}
 */
export async function getArgs(interaction) {
    if(!(interaction instanceof CommandInteraction)) return [];

    const slashCommand = await interaction.client.application.commands.fetch(interaction.commandId);

    const args = [];
    let incrementIndex = 0;

    function addArgs(allOptions, option) {
        //we use an index instead of push because users can select options in any order they want
        const allOptionsIndex = allOptions.findIndex(opt => opt.name === option.name);
        // Option has to be pushed further back if there are subcommands or subcommand groups before it
        const argOptionIndex = allOptions.findIndex(opt => opt.name === option.name) + incrementIndex;

        if(option.type === ApplicationCommandOptionType.SubcommandGroup || option.type === ApplicationCommandOptionType.Subcommand) {
            args.push(option.name);
            incrementIndex++;
            option.options.forEach(opt => addArgs(allOptions[allOptionsIndex].options, opt));
        }
        else if(option.type === ApplicationCommandOptionType.Channel) args[argOptionIndex] = option.channel;
        else if(option.type === ApplicationCommandOptionType.User) args[argOptionIndex] = option.user;
        else if(option.type === ApplicationCommandOptionType.Role) args[argOptionIndex] = option.role;
        else if(option.type === ApplicationCommandOptionType.Attachment) args[argOptionIndex] = option.attachment;
        else args[argOptionIndex] = option.value;
    }

    interaction.options.data.forEach(option => addArgs(slashCommand.options, option));

    return args;
}

/**
 * Gets a list of users from a string of mentions.
 * @param {Client} client - The client to use.
 * @param {string} mention - The string of mentions.
 * @returns {Promise<User[]>}
 */
export async function getUsersFromMention(client, mention) {
    if(typeof mention !== 'string') return [];

    const usersPattern = new RegExp(MessageMentions.UsersPattern.source, 'g');
    const matches = mention.matchAll(usersPattern);
    if(!matches) return [];

    const userArray = [];
    for(const match of matches) {
        // match[0] = entire mention
        // match[1] = Id
        userArray.push(await client.users.fetch(match[1]));
    }

    return userArray;
}

/**
 * Disables all components of an action row and returns a new one.
 * @param {ActionRow[]} rows - The message to disable the components of.
 * @returns {ActionRowBuilder[]} - An action row builder array with all components disabled.
 */
export function disableComponents(rows) {
    return rows.map(row => {
        row = ActionRowBuilder.from(row);
        const disabledComponents = row.components.map(component => component.setDisabled(true));
        row.setComponents(...disabledComponents);
        return row;
    });
}

/**
 * Flatten action rows to get all components in an array
 * @param {import('discord.js').ActionRowBuilder[]} actionRows - The action rows to flatten
 * @return {import('discord.js').ComponentBuilder[]} - An array of all components in the action rows
 * @private
 */
export function flattenActionRows(actionRows) {
    return actionRows?.flatMap(row => row.components) ?? [];
}

/**
 * Checks if a member has permission to send messages in a channel.
 * @param {GuildMember} member - The member to check.
 * @param {GuildChannel} channel - The channel to check.
 * @param {Boolean} [sendEmbed=true] - Whether the member needs to be able to send embeds.
 * @returns {Boolean} - Whether the member can send messages in the channel.
 */
export function canSendMessages(member, channel, sendEmbed = true) {
    const permissions = channel.permissionsFor(member);
    if(!permissions.has(PermissionFlagsBits.ViewChannel)) return false;

    if(channel.isThread() && !permissions.has(PermissionFlagsBits.SendMessagesInThreads)) return false;
    else if(!permissions.has(PermissionFlagsBits.SendMessages)) return false;
    else if(sendEmbed && !permissions.has(PermissionFlagsBits.EmbedLinks)) return false;
    return true;
}

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
export async function sendToServer(guild, key, ...placeholders) {
    const replyOptions = getReplyOptions(key, ...placeholders);

    if(await trySendMessage(guild.systemChannel)) return;
    if(await trySendMessage(guild.publicUpdatesChannel)) return;

    const sortedChannels = await sortChannels(guild);
    for(const channel of sortedChannels) {
        if(await trySendMessage(channel)) return;
    }

    trackError('unhandled', 'sendToServer', guild.id, null, new Error('Could not send message to any channel in guild'), null, logger);

    async function trySendMessage(channel) {
        if(!channel || !channel.isTextBased()) return false;
        try {
            await channel.send(replyOptions);
            return true;
        }
        catch {
            return false;
        }
    }
}

/**
 * Sort channels in a guild by their position
 * @param {Guild} guild - The guild to sort the channels in
 * @returns {Promise<Discord.Channel[]>}
 */
export async function sortChannels(guild) {
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

/**
 * Fetches all members of a guild if the member count differs from the cache.
 * @param {Client} client - The client to use for fetching.
 * @param {Guild} guild - The guild to fetch the members of if the member count differs.
 */
export async function fetchMembersIfCacheDiffers(client, guild) {
    // If cache differs, fetch all members to ensure their roles are cached
    if(guild.memberCount !== guild.members.cache.size) await guild.members.fetch();
}

/**
 * Generates a default invite link for a bot.
 * Will include the permissions set up in the developer portal.
 * @param {string} botId - The id of the bot to generate the invite for.
 * @return {'https://discord.com/api/oauth2/authorize?client_id=${botId}'}
 */
export function generateDefaultInvite(botId) {
    return `https://discord.com/api${Routes.oauth2Authorization()}?client_id=${botId}`;
}

/**
 * Uploads all emojis from the resources/emojis folder to the given client.
 * @param {Discord.Client} client - The client to upload the emojis to.
 * @returns {Promise<{string, string}>} - A map of emoji names to their codes.
 */
export async function uploadApplicationEmojis(client) {
    const emojiDir = './resources/emojis';
    const emojiFiles = (await fs.readdir(emojiDir))
        .filter(file => /\.(png|jpg|jpeg|gif|webp)$/i.test(file));

    const emojiMap = {};
    const existingEmojis = await client.application.emojis.fetch();
    for(const file of emojiFiles) {
        const emojiName = path.parse(file).name;
        try {
            const existingEmoji = existingEmojis.find(e => e.name === emojiName);
            if(existingEmoji) {
                emojiMap[emojiName] = Discord.formatEmoji(existingEmoji);
                logger.debug(`Emoji ${emojiName} already exists, skipping upload`);
                continue;
            }

            const emoji = await client.application.emojis.create({
                attachment: `${emojiDir}/${file}`,
                name: emojiName,
            });
            emojiMap[emojiName] = Discord.formatEmoji(emoji);
            logger.debug(`Uploaded emoji ${emojiName} (${emoji.id})`);
        }
        catch(err) {
            trackError('unhandled', 'utils', null, null, err, null, logger);
        }
    }
    return emojiMap;
}
