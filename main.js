// @ts-nocheck
// noinspection JSUnresolvedFunction,JSUnresolvedVariable

console.log('Loading...');

const fs = require('fs');
const Discord = require('discord.js');
const { AutoPoster } = require('topgg-autoposter');
const plugin = require('./api/plugin');
const helpCommand = require('./src/help');
const disableButton = require('./src/disableButton');
const enableButton = require('./src/enableButton');
const { prefix, token, topggToken } = require('./config.json');
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.DIRECT_MESSAGES] });

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} The formatted string.
 */
String.prototype.cap = function() {
    return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase()
};

if(topggToken) {
    const ap = AutoPoster(topggToken, client);

    ap.on('posted', stats => {
        console.log('Posted stats to Top.gg!', stats);
    });
}

client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag} and with prefix: ${prefix}\nBot on ${client.guilds.cache.size} server.`);
    client.user.setActivity('/help', { type: 'LISTENING' });
    plugin.loadExpress(client);
});

client.on('guildCreate', guild => {
    console.log(`Joined a guild: ${guild.name}: ${guild.memberCount} members.\nBot is now on ${client.guilds.cache.size} servers!`);
});

client.on('guildDelete', async guild => {
    console.log(`Left a guild: ${guild.name}\nBot is now on ${client.guilds.cache.size} servers!`);

    //Delete disable files
    ['stats', 'advancements', 'commands'].forEach(type => {
        fs.readdir(`./disable/${type}/`, (err, files) => {
            if (err) console.log('Could not list disabled files.');
            else {
                files.forEach(file => {
                    if (file.startsWith(guild.id)) {
                        fs.rm(`./disable/${type}/${file}`, err => {
                            if (err) console.log(`Could not delete disable file: ./disable/${type}/${file}`);
                        });
                    }
                });
            }
        });
    });

    const message = {};
    message.reply = () => {};
    await plugin.disconnect(guild.id, message);

    //Delete connection file
    fs.rm(`./connections/servers/${guild.id}.json`, err => {
        if (err) console.log(`No connection file found for guild: ${guild.name}`);
        else console.log(`Successfully deleted connection file of guild: ${guild.name}`);
    });
});

client.commands = new Discord.Collection();
const commandFolders = fs.readdirSync('./commands/');
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(command => command.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(command.name, command);
	}
}


client.on('messageCreate', message => {
    plugin.chat(message);
    if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.reply(':wave: I use slash commands. Type `/help` if you need more help to a specific command.');
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();


    if(commandName === 'help') helpCommand.execute(message, args);
    else {
        const command = client.commands.get(commandName) ?? client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (!command) console.log(`${message.member.user.tag} executed non-existent command ${commandName} in ${message.guild.name}`);
        else {
            fs.access(`./disable/commands/${message.guild.id}_${command.name}`, err => {
                if (err) {
                    try {
                        command.execute(message, args);
                    } catch (err) {
                        console.log(`${message.member.user.tag} executed ^${command.name}. Couldn\'t execute that command!`, err);
                        message.reply('<:Error:849215023264169985> An unknown error occurred while executing this command!');
                    }
                } else {
                    console.log(`${message.member.user.tag} executed disabled command [${command.name}] in ${message.guild.name}`);
                    message.reply(`:no_entry: Command [**${command.name}**] disabled!`);
                }
            });
        }

    }
});

client.on('interactionCreate', async interaction => {
    if(!interaction.guildId) return interaction.reply(':warning: I can only be used in server channels!');

    if(interaction.isCommand()) {

        //Making it compatible with normal commands
        if(interaction.options.getUser('user')) {
            interaction.mentions = {
                users: new Discord.Collection().set(interaction.options.getUser('user').id, interaction.options.getUser('user'))
            }
        } else interaction.mentions = { users: new Discord.Collection() }
        interaction.attachments = [];

        const args = [];
        if(interaction.options._group) args.push(interaction.options._group);
        if(interaction.options._subcommand) args.push(interaction.options._subcommand);
        interaction.options._hoistedOptions.forEach(option => {
            if (option.value === interaction.options.getUser('user')?.id) args.splice(0, 0, option.user);
            else if(option[option.type.toLowerCase()]) args.push(option[option.type.toLowerCase()]);
            else args.push(option.value);
        });

        interaction.reply = function (content) {
            return interaction.editReply(content);
        }

        if (interaction.commandName === 'help') {
            await interaction.deferReply().catch(console.log);
            helpCommand.execute(interaction, args);
        } else {
            const command = client.commands.get(interaction.commandName);

            if (!command) console.log(`${interaction.member.user.tag} executed non-existent command ${commandName} in ${interaction.guild.name}`);
            else {
                fs.access(`./disable/commands/${interaction.guild.id}_${command.name}`, async err => {
                    if(interaction.commandName !== 'message') await interaction.deferReply();
                    else await interaction.deferReply({ ephemeral: true });
                    if (err) {
                        try {
                            command.execute(interaction, args);
                        } catch (err) {
                            console.log(`${interaction.member.user.tag} executed SlashCommand ${command.name}. Couldn't execute that command!`, err);
                            interaction.reply('<:Error:849215023264169985> There was an error while executing this command!');
                        }
                    } else {
                        console.log(`${interaction.member.user.tag} executed disabled SlashCommand [${command.name}] in ${interaction.guild.name}`);
                        interaction.reply(`:no_entry: Command [**${command.name}**] disabled!`);
                    }
                });
            }
        }

    } else if(interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if(!command) return;
        command.autocomplete(interaction);

    } else if (interaction.isButton()) {
        await interaction.deferReply({ ephemeral: true });
        if (interaction.customId.startsWith('disable')) {
            disableButton.execute(interaction);
        } else if (interaction.customId.startsWith('enable')) {
            enableButton.execute(interaction);
        }
    }
});

client.login(token);