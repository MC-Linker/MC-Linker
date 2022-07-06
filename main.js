console.log(
    '\x1b[1m'     + // Bold (1)
    '\x1b[44;37m' + // Blue BG (44); White FG (37)
    '%s'          + // Insert second argument
    '\x1b[0m',      // Reset color (0)
    'Loading...'    // Second argument (%s)
);

const fs = require('fs-extra');
const Discord = require('discord.js');
const { AutoPoster } = require('topgg-autoposter');
const plugin = require('./api/plugin');
const helpCommand = require('./src/help');
const disableButton = require('./src/disableButton');
const enableButton = require('./src/enableButton');
const settings = require('./api/settings');
const { getArgs, addPh, keys, reply, replyOptions, ph } = require('./api/messages');
const { prefix, token, topggToken } = require('./config.json');
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.DIRECT_MESSAGES] });

//Handle rejected promises
process.on('unhandledRejection', async err => {
    console.log(addPh(keys.main.errors.unknown_rejection.console, ph.fromError(err)));
});

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} The formatted string.
 */
String.prototype.cap = function() {
    return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase();
};

if(topggToken) {
    const poster = AutoPoster(topggToken, client);

    poster.on('posted', () => {});
    poster.on('error', () => console.log(keys.main.errors.could_not_post_stats.console));
}

client.once('ready', async () => {
    console.log(addPh(keys.main.success.login.console, ph.fromClient(client), { prefix, "guild_count": client.guilds.cache.size }));
    client.user.setActivity('/help', { type: 'LISTENING' });
    await plugin.loadExpress(client);
});

client.on('guildCreate', guild => {
    if(guild?.name === undefined) return console.log(addPh(keys.main.warnings.undefined_guild_create.console, { guild }));
    console.log(addPh(keys.main.success.guild_create.console, ph.fromGuild(guild), { "guild_count": client.guilds.cache.size }));
});

client.on('guildDelete', async guild => {

    if(guild?.name === undefined) return console.log(addPh(keys.main.warnings.undefined_guild_delete.console, { guild }));
    console.log(addPh(keys.main.success.guild_delete.console, ph.fromGuild(guild), { "guild_count": client.guilds.cache.size }));

    await plugin.disconnect(guild.id, guild.client);

    //Delete connection folder
    fs.remove(`./serverdata/connections/${guild.id}`, err => {
        if (err) console.log(addPh(keys.main.errors.no_connection_file.console, ph.fromGuild(guild)));
        else console.log(addPh(keys.main.success.disconnected.console, ph.fromGuild(guild)));
    });
});

client.commands = new Discord.Collection();
const commandFolders = fs.readdirSync('./commands/');
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(command => command.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(file.replace('.js', ''), command);
	}
}


client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix)) plugin.chat(message);

    //Add own response handlers
    message.respond = (key, ...placeholders) => {
        return reply(message, key, ...placeholders);
    };
    message.replyOptions = options => {
        return replyOptions(message, options);
    };

    if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.respond(keys.main.success.ping);
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    //check if in guild
    if(!message.guildId) return message.respond(keys.main.warnings.not_in_guild);

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if(commandName === 'help') {
        message.respond(keys.commands.executed);
        await helpCommand.execute(message, args);
    } else {
        const command = client.commands.get(commandName);
        if(!command) return;

        message.respond(keys.commands.executed);

        if(await settings.isDisabled(message.guildId, 'commands', commandName)) {
            message.respond(keys.main.warnings.disabled);
        }

        try {
            await command?.execute?.(message, args)
                .catch(err => message.respond(keys.main.errors.could_not_execute_command, ph.fromError(err)));
        } catch (err) {
            message.respond(keys.main.errors.could_not_execute_command, ph.fromError(err))
        }
    }
});

client.on('interactionCreate', async interaction => {
    //Add own response handlers if not autocomplete
    if(!interaction.isAutocomplete()) {
        interaction.respond = (key, ...placeholders) => {
            return reply(interaction, key, ...placeholders);
        };
        interaction.replyOptions = options => {
            return replyOptions(interaction, options);
        };
    }

    //check if in guild
    if(!interaction.guildId) return interaction.respond(keys.main.warnings.not_in_guild);

    if(interaction.isCommand()) {

        //Making interaction compatible with normal commands
        interaction.mentions = {
            users: new Discord.Collection(),
            roles: new Discord.Collection(),
            channels: new Discord.Collection(),
        };
        interaction.attachments = new Discord.Collection();


        const args = getArgs(client, interaction);
        //Add mentions and attachments from args
        args.forEach(arg => {
            if(arg instanceof Discord.User) interaction.mentions.users.set(arg.id, arg);
            else if(arg instanceof Discord.Role) interaction.mentions.roles.set(arg.id, arg);
            else if(arg instanceof Discord.Channel) interaction.mentions.channels.set(arg.id, arg);
            else if(arg instanceof Discord.MessageAttachment) interaction.attachments.set(arg.id, arg);
        });

        if(interaction.commandName === 'message') await interaction?.deferReply({ ephemeral: true });
        else await interaction?.deferReply();

        if (interaction.commandName === 'help') {
            interaction.respond(keys.commands.executed);
            await helpCommand.execute(interaction, args);
        } else {
            const command = client.commands.get(interaction.commandName);

            interaction.respond(keys.commands.executed);

            //Check if command disabled
            if(await settings.isDisabled(interaction.guildId, 'commands', interaction.commandName)) {
                interaction.respond(keys.main.warnings.disabled);
                return;
            }

            try {
                await command?.execute?.(interaction, args)
                    .catch(err => interaction.respond(keys.main.errors.could_not_execute_command, ph.fromError(err)));
            } catch (err) {
                interaction.respond(keys.main.errors.could_not_execute_command, ph.fromError(err));
            }
        }

    } else if(interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if(!command) return;
        command?.autocomplete?.(interaction);

    } else if (interaction.isButton()) {
        console.log(addPh(keys.buttons.clicked.console, { "button_id": interaction.customId }, ph.fromStd(interaction)));

        await interaction.deferReply({ ephemeral: true });
        if (interaction.customId.startsWith('disable')) {
            await disableButton.execute(interaction);
        } else if (interaction.customId.startsWith('enable')) {
            await enableButton.execute(interaction);
        }
    }
});

const login = () => client.login(token);
login();

module.exports = { login, client };