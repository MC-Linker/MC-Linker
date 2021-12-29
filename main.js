// @ts-nocheck
// noinspection JSUnresolvedFunction,JSUnresolvedVariable

console.log('Loading...');

const fs = require('fs');
const Discord = require('discord.js');
const { AutoPoster } = require('topgg-autoposter');
const plugin = require('./api/plugin');
const helpCommand = require('./help');
const { prefix, token, discordLink, topggToken } = require('./config.json');
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

    if(process.argv.slice(2).shift() === '--delete') {
        const cmds = await client.application.commands.fetch({ guildId: '844156404477853716' });
        cmds.forEach(cmd => {
            cmd.delete();
            console.log(`Deleted ${cmd.name.toUpperCase()}`);
        });
    }

    plugin.loadExpress(client);
});

/*async function editFile(path, valueToChange, expression) {
    const content = JSON.parse(await fs.readFile(path));
    content[valueToChange] = expression;
    console.log(content)
    await fs.writeFile(path, JSON.stringify(content, null, 2));
}*/

client.on('guildCreate', guild => {
    console.log(`Joined a guild: ${guild.name}: ${guild.memberCount} members.\nBot is now on ${client.guilds.cache.size} servers!`);
});

client.on('guildDelete', guild => {
    console.log(`Left a guild: ${guild.name}\nBot is now on ${client.guilds.cache.size} servers!`);

    //Delete disable files
    ['stats', 'advancements', 'commands'].forEach(type => {
        fs.readdir(`./disable/${type}/`, (err, files) => {
            if(err) {
                console.log('Could not list disabled advancements.');
            } else {
                files.forEach(file => {
                    if(file.startsWith(guild.id)) fs.rm(`./disable/${type}/${file}`, err => {
                        if(err) console.log(`Could not delete disable file: ./disable/${type}/${file}`);
                    });
                });
            }
        });
    })

    fs.rm(`./connections/servers/${guild.id}.json`, err => {
        if(err) {
            console.log(`No ftpFile found for guild: ${guild.name}`);
        } else {
            console.log(`Successfully deleted ftpFile of guild: ${guild.name}`);
        }
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


    if(commandName === 'help') helpCommand.execute(client, message, args);
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
            await interaction.deferReply();
            helpCommand.execute(client, interaction, args);
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
            if (interaction.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
                const command = interaction.customId.split('_').pop();
                console.log(`${interaction.member.user.tag} clicked disableButton: ${command} in ${interaction.guild.name}`);
                fs.writeFile(`./disable/commands/${interaction.guild.id}_${command}`, '', err => {
                    if (err) {
                        console.log('Error writing commandDisableFile ', err);
                        interaction.editReply(`<:Error:849215023264169985> Couldn't disable Command!`);
                    } else {
                        console.log(`Successfully wrote commandDisableFile: ./disable/commands/${interaction.guild.id}_${command}`);
                        interaction.editReply(`<:Checkmark:849224496232660992> Disabling of command [**${command}**] successful.`);
                    }
                })

                const enableRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle('SUCCESS')
                            .setCustomId('enable_' + command)
                            .setLabel('Enable this command!')
                            .setEmoji('<:Checkmark:849224496232660992>'),
                    );

                const commandObject = client.commands.get(command);
                const helpEmbed = baseEmbed.addField(commandObject.name.toUpperCase(), `${commandObject.description}\n\n**USAGE**: ${commandObject.usage}\n\n**EXAMPLE**: ${commandObject.example}\n\n**ALIASES**: \n${commandObject.aliases.join(', ')}`)
                    .setDescription('```diff\n- [COMMAND DISABLED]```')
                    .setColor('DARK_RED');
                interaction.message.edit({ embeds: [helpEmbed], components: [enableRow] });
            } else {
                console.log(`Clicker of ${interaction.customId} doesnt have admin.`);
                interaction.editReply(':no_entry: You must be an administrator to use that button!');
            }

        } else if (interaction.customId.startsWith('enable')) {
            if (interaction.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
                const command = interaction.customId.split('_').pop();
                console.log(`${interaction.member.user.tag} clicked enableButton: ${command} in ${interaction.guild.name}`);
                fs.rm(`./disable/commands/${interaction.guild.id}_${command}`, err => {
                    if(err) {
                        console.log('Error deleting commandDisableFile ', err);
                        interaction.editReply(`<:Error:849215023264169985> Couldn't enable Command! Is it already enabled?`);
                    } else {
                        console.log(`Successfully deleted commandDisableFile: ./disable/commands/${interaction.guild.id}_${command}`);
                        interaction.editReply(`<:Checkmark:849224496232660992> Enabling of command [**${command}**] successful.`);
                    }
                });

                const disableRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle('DANGER')
                            .setCustomId('disable_' + command)
                            .setLabel('Disable this command!')
                            .setEmoji('<:Error:849215023264169985>'),
                    );

                const commandObject = client.commands.get(command);
                const helpEmbed = baseEmbed.addField(commandObject.name.toUpperCase(), commandObject.description + `\n\n**USAGE**: ${commandObject.usage}\n\n**EXAMPLE**: ${commandObject.example}\n\n**ALIASES**: \n${commandObject.aliases.join(', ')}`)
                    .setDescription('```diff\n+ [Command enabled]```')
                    .setColor('GREEN');
                interaction.message.edit({ embeds: [helpEmbed], components: [disableRow] })
            } else {
                console.log(`Clicker of ${interaction.customId} doesnt have admin.`);
                interaction.editReply(':no_entry: You must be an administrator to use that button!');
            }
        }
    }
});

client.login(token);