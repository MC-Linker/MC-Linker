// @ts-nocheck
console.log('Loading...');

const { prefix, token } = require('../config.json');
const Discord = require('discord.js');
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILDS] });
const fs = require('fs');
const { AutoPoster } = require('topgg-autoposter');

const ap = AutoPoster('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjcxMjc1OTc0MTUyODQwODA2NCIsImJvdCI6dHJ1ZSwiaWF0IjoxNjI4MjM5MDQ0fQ.09hsMh8jvu87wrxOwvF2OqyfnePIN-4FMqGRdFQm0Fo', client);

ap.on('posted', stats => {
  console.log('Posted stats to Top.gg!', stats);
})

client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + ' and with prefix: ' + prefix + '\nBot on ' + client.guilds.cache.size + ' server.');
    client.user.setActivity(prefix + 'help', {type: "LISTENING"});
})

client.on("guildCreate", guild => {
    console.log("Joined a new guild: " + guild.name + ': ' + guild.memberCount + ' members.\nBot is now on ' + client.guilds.cache.size + ' server!');
})
client.on("guildDelete", guild => {
    console.log("Left a guild: " + guild.name + '\nBot is now on ' + client.guilds.cache.size + ' server!');
    fs.unlink(`./ftp/${guild.id}.json`, err => {
        if(err) {
            console.log('No ftpFile found for guild: ' + guild.name);
        } else {
            console.log('Successfully deleted ftpFile of guild: ' + guild.name);
        }
    })
})

client.commands = new Discord.Collection();
const commandFolders = fs.readdirSync('./commands/');
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`);
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(command.name, command);
	}
}

client.on('messageCreate', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if(commandName === 'help') {

        if(!args[0]) {
            console.log(message.member.user.tag + ' executed ^help in ' + message.guild.name);

            let helpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')
                .setFooter('\u200B', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .addField(':label: Main :label:', 'Main commands such as `^stats`, or `^inventory`.')
                .addField(':shield: Moderation :shield:', 'Moderation commands such as `^ban` or `^unban`.')
                .addField(':point_right: Other :point_left:', 'Other commands such as `^txp` or `^text`.')
                .addField(':gear: Settings :gear:', 'Setup and settings such as `^disable` or `^ftp`')
                .addField('\u200B', '**All commands in a category** can be viewed with: **^help <category>**\n**Still need help?** => [Support Discord Server](https://discord.gg/rX36kZUGNK)');

            message.channel.send({ embeds: [helpEmbed] });

        } else {
            let commandName = (args[0]).toLowerCase();
            if(commandName === 'mod' || commandName === 'Mod') commandName = 'Moderation'

            let helpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')

            let command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
            if (!command) {
                fs.readdir(`./commands/${commandName}`, (err, commands) => {
                    if(err) {
                        console.log(message.member.user.tag + ' executed non-existent help command/category ' + commandName + ' in ' + message.guild.id);
                        message.channel.send(':warning: That command/category [**' + commandName + '**] doesnt exist.');
                        return;
                    }
                    console.log(message.member.user.tag + ' executed ^help ' + commandName + ' in ' + message.guild.name);

                    commands.forEach(commandFile => {
                        commandFile = commandFile.split('.').shift();
                        command = client.commands.get(commandFile) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandFile));
                        helpEmbed.addField(command.name.toUpperCase(), command.description);
                    });
                    helpEmbed.addField('\u200B', '**More info to a command** can be viewed with: **^help <command>**\n**Still need help?** => [Support Discord Server](https://discord.gg/rX36kZUGNK)');
                    message.channel.send({ embeds: [helpEmbed] });
                })
            } else {
                console.log(message.member.user.tag + ' executed ^help ' + commandName + ' in ' + message.guild.name);

                helpEmbed.addField(command.name.toUpperCase(), command.description + `\n\n**USAGE**: \n${command.usage}\n\n**EXAMPLE**: \n${command.example}`);
                if(command.aliases[0]) helpEmbed.addField('\n**ALIASES**', command.aliases.join(', '));

                const disableRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle('DANGER')
                            .setCustomId('disable_' + command.name)
                            .setLabel('Disable this command!')
                            .setEmoji('<:Error:849215023264169985>'),
                    );
                const enableRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setStyle('SUCCESS')
                            .setCustomId('enable_' + command.name)
                            .setLabel('Enable this command!')
                            .setEmoji('<:Checkmark:849224496232660992>'),
                    );

                const disabled = fs.existsSync('./disable/commands/' + message.guild.id + '_' + command.name);
                if (disabled === false) {
                    message.reply({ embeds: [helpEmbed], components: [disableRow], allowedMentions: { repliedUser: false } });
                } else if (disabled === true) {
                    helpEmbed.setDescription('You can find helpful information here. \n ```diff\n- [COMMAND DISABLED]```');
                    message.channel.send({ embeds: [helpEmbed], components: [enableRow] });
                }
            }
        }

    } else {
        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (!command) {console.log(message.member.user.tag + ' executed non-existent command ' + commandName + ' in ' + message.guild.name); return;}
        fs.access('./disable/commands/' + message.guild.id + '_' + command.name, fs.constants.F_OK, (err) => {
            if (err) {
                try {
                    command.execute(message, args);
                } catch (err) {
                    console.log(message.member.user.tag + ' executed ^' + command.name + '. Couldnt execute that command!', err);
                    message.reply('<:Error:849215023264169985> here was an error while executing this command!');
                }
            } else {
                console.log(message.member.user.tag + ' executed disabled command [' + command.name + '] in ' + message.guild.name);
                message.reply(':no_entry: Command [**' + command.name + '**] disabled!');
                return;
            }
        });
    }
})

client.on('interactionCreate', async interaction => {
    if(interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {console.log(interaction.member.user.tag + ' executed non-existent command ' + commandName + ' in ' + interaction.guild.name); return;}
        fs.access('./disable/commands/' + interaction.guild.id + '_' + command.name, fs.constants.F_OK, async err => {
            if (err) {
                try {
                    if(interaction.options.getUser('user')) {
                        interaction.mentions = {
                            users: new Discord.Collection().set(interaction.options.getUser('user').id, interaction.options.getUser('user'))
                        }
                    } else interaction.mentions = { users: [] }
                    interaction.attachments = [];

                    const args = [];
                    if(interaction.options._group) args.push(interaction.options._group);
                    if(interaction.commandName === 'ftp' && interaction.options._subcommand === 'connect') {}
                    else args.push(interaction.options._subcommand);
                    interaction.options._hoistedOptions.forEach(option => {
                        if (option.value !== interaction.options.getUser('user')?.id) args.push(option.value);
                        else args.splice(0, 0, option.value);
                    })

                    interaction.reply = function (content) { 
                        interaction.editReply(content);
                    }

                    await interaction.deferReply();
                    command.execute(interaction, args);
                } catch (err) {
                    console.log(interaction.member.user.tag + ' executed slashCommand ' + command.name + '. Couldnt execute that command!', err);
                    interaction.reply('<:Error:849215023264169985> There was an error while executing this command!');
                }
            } else {
                console.log(interaction.member.user.tag + ' executed disabled slashCommand [' + command.name + '] in ' + interaction.guild.name);
                interaction.reply(':no_entry: Command [**' + command.name + '**] disabled!');
                return;
            }
        });
    }
    else if (interaction.isButton()) {
        if (interaction.customId.startsWith('disable')) {
            if (interaction.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
                const command = interaction.customId.split('_').pop();
                console.log(interaction.member.user.tag + ' clicked disableButton: ' + command + ' in ' + interaction.guild.name);
                fs.writeFile('./disable/commands/' + interaction.guild.id + "_" + command, '', err => {
                    if (err) {
                        console.log('Error writing commandDisableFile ', err);
                        interaction.message.reply(`<@${interaction.member.user.id}>, <:Error:849215023264169985> Couldn't disable Command!`);
                        return;
                    } else {
                        console.log('Successfully wrote commandDisableFile: ' + './disable/commands/' + interaction.guild.id + "_" + command);
                        interaction.message.reply(`<@${interaction.member.user.id}>, <:Checkmark:849224496232660992> Disabling of command [**${command}**] succesful.`);
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
                helpEmbed = new Discord.MessageEmbed()
                    .setTitle('Help Menu')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .setColor('#000000')
                    .addField(commandObject.name.toUpperCase(), commandObject.description + `\n\n**USAGE**: ${commandObject.usage}\n\n**EXAMPLE**: ${commandObject.example}\n\n**ALIASES**: \n${commandObject.aliases.join(', ')}`)
                    .setDescription('```diff\n- [COMMAND DISABLED]```')
                    .setColor('DARK_RED');
                interaction.message.edit({ embeds: [helpEmbed], components: [enableRow] });

                interaction.deferUpdate();
            } else {
                console.log('Clicker of ' + interaction.customId + ' doesnt have admin.');
                interaction.message.reply(':no_entry: You must be an administrator to use that button!');
                return;
            }

        } else if (interaction.customId.startsWith('enable')) {
            if (interaction.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
                const command = interaction.customId.split('_').pop();
                console.log(interaction.member.user.tag + ' clicked enableButton: ' + command + ' in ' + interaction.guild.name);
                fs.unlink('./disable/commands/' + interaction.guild.id + "_" + command, err => {
                    if(err) {
                        console.log('Error deleting commandDisableFile ', err);
                        interaction.message.reply(`<@${interaction.member.user.id}>, <:Error:849215023264169985> Couldn't enable Command! Is it already enabled?`); 
                        return;
                    } else {
                        console.log('Successfully deleted commandDisableFile: ' + './disable/commands/' + interaction.guild.id + "_" + command);
                        interaction.message.reply(`<@${interaction.member.user.id}>, <:Checkmark:849224496232660992> Enabling of command [**${command}**] succesful.`, true);
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
                helpEmbed = new Discord.MessageEmbed()
                    .setTitle('Help Menu')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .setColor('#000000')
                    .addField(commandObject.name.toUpperCase(), commandObject.description + `\n\n**USAGE**: ${commandObject.usage}\n\n**EXAMPLE**: ${commandObject.example}\n\n**ALIASES**: \n${commandObject.aliases.join(', ')}`)
                    .setDescription('```diff\n+ [Command enabled]```')
                    .setColor('GREEN');
                interaction.message.edit({ embeds: [helpEmbed], components: [disableRow] })

                interaction.deferUpdate();
            } else {
                console.log('Clicker of ' + interaction.customId + ' doesnt have admin.');
                interaction.message.reply(':no_entry: You must be an administrator to use that button!');
                return;
            }
        }
    } else {
        return;
    }
});

client.login(token);