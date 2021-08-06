// @ts-nocheck
console.log('Loading...');

const { prefix, token } = require('../config.json');
const Discord = require('discord.js');
const client = new Discord.Client()
const fs = require('fs');
const disbut = require('discord-buttons');
disbut(client);
const { AutoPoster } = require('topgg-autoposter');

const ap = AutoPoster('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjcxMjc1OTc0MTUyODQwODA2NCIsImJvdCI6dHJ1ZSwiaWF0IjoxNjI4MjM5MDQ0fQ.09hsMh8jvu87wrxOwvF2OqyfnePIN-4FMqGRdFQm0Fo', client)

ap.on('posted', stats => {
  console.log('Posted stats to Top.gg!', stats);
})

client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + ' and with prefix: ' + prefix + '\nBot on ' + client.guilds.cache.size + ' server.')
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
            console.log('Successfully deleted ftpFile.');
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

client.on('message', (message) => {
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

            message.channel.send(helpEmbed);

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
                        message.reply('That command/category [**' + commandName + '**] doesnt exist.');
                        return;
                    }
                    console.log(message.member.user.tag + ' executed ^help ' + commandName + ' in ' + message.guild.name);

                    commands.forEach(commandFile => {
                        commandFile = commandFile.split('.').shift();
                        command = client.commands.get(commandFile) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandFile));
                        helpEmbed.addField(command.name.toUpperCase(), command.description);
                    });
                    helpEmbed.addField('\u200B', '**All commands in a category** can be viewed with: **^help <catgory>**\n**Still need help?** => [Support Discord Server](https://discord.gg/rX36kZUGNK)');
                    message.channel.send(helpEmbed);
                })
            } else {
                console.log(message.member.user.tag + ' executed ^help ' + commandName + ' in ' + message.guild.name);

                helpEmbed.addField(command.name.toUpperCase(), command.description + `\n\n**USAGE**: \n${command.usage}\n\n**EXAMPLE**: \n${command.example}\n\n**ALIASES**: \n${command.aliases.join(', ')}`);

                const disableButton = new disbut.MessageButton()
                    .setStyle('red')
                    .setID('disable_' + command.name)
                    .setLabel('Disable this command!');
                const enableButton = new disbut.MessageButton()
                    .setStyle('green')
                    .setID('enable_' + command.name)
                    .setLabel('Enable this command!');

                const disabled = fs.existsSync('./disable/commands/' + message.guild.id + '_' + command.name);
                if (disabled === false) {
                    message.channel.send({embed: helpEmbed, button: disableButton});
                } else if (disabled === true) {
                    helpEmbed.setDescription('You can find helpful information here. \n ```diff\n- [COMMAND DISABLED]```');
                    message.channel.send({embed: helpEmbed, button: enableButton});
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
                }
            } else {
                console.log(message.member.user.tag + ' executed disabled command [' + command.name + '] in ' + message.guild.name);
                message.reply(':no_entry: Command [**' + command.name + '**] disabled!');
                return;
            }
        });
    }
})

client.on('clickButton', async (button) => {
    await button.clicker.fetch();

    if (button.id.startsWith('disable')) {
        if (button.clicker.member.hasPermission('ADMINISTRATOR')) {
            const command = button.id.split('_').pop();
            console.log(button.clicker.user.tag + ' clicked disableButton: ' + command + ' in ' + button.guild.name);
            fs.writeFile('./disable/commands/' + button.guild.id + "_" + command, '', err => {
                if (err) {
                    console.log('Error writing commandDisableFile ', err);
                    button.reply.send(`<@${button.clicker.user.id}>, <:Error:849215023264169985> Couldn't disable Command!`);
                    return;
                } else {
                    console.log('Successfully wrote commandDisableFile: ' + './disable/commands/' + button.guild.id + "_" + command);
                    button.reply.send(`<@${button.clicker.user.id}>, <:Checkmark:849224496232660992> Disabling of command: [**${command}**] succesful.`, true);
                }
            })

            helpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')
                .addField(client.commands.get(command).name.toUpperCase(), client.commands.get(command).description + `\n\n**USAGE**: ${client.commands.get(command).usage}\n\n**EXAMPLE**: ${client.commands.get(command).example}\n\n**ALIASES**: \n${client.commands.get(command).aliases.join(', ')}`);

            const enableButton = new disbut.MessageButton()
                .setStyle('green')
                .setID('enable_' + command)
                .setLabel('Enable this command!');
            
            helpEmbed.setDescription('```diff\n- [COMMAND DISABLED]```')
                     .setColor('DARK_RED');
            button.message.edit({embed: helpEmbed, button: enableButton});

            button.reply.defer();
        } else {
            console.log('Clicker of ' + button.id + ' doesnt have admin.');
            button.reply.send('You must be an administrator to use that button!');
            return;
        }

    } else if (button.id.startsWith('enable')) {
        if (button.clicker.member.hasPermission('ADMINISTRATOR')) {
            const command = button.id.split('_').pop();
            console.log(button.clicker.user.tag + ' clicked enableButton: ' + command + ' in ' + button.guild.name);
            fs.unlink('./disable/commands/' + button.guild.id + "_" + command, err => {
                if(err) {
                    console.log('Error deleting commandDisableFile ', err);
                    button.reply.send(`<@${button.clicker.user.id}>, <:Error:849215023264169985> Couldn't enable Command! Is it already enabled?`); 
                    return;
                } else {
                    console.log('Successfully deleted commandDisableFile: ' + './disable/commands/' + button.guild.id + "_" + command);
                    button.reply.send(`<@${button.clicker.user.id}>, <:Checkmark:849224496232660992> Enabling of command: [**${command}**] succesful.`, true);
                }
            });
            helpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')
                .addField(client.commands.get(command).name.toUpperCase(), client.commands.get(command).description + `\n\n**USAGE**: ${client.commands.get(command).usage}\n\n**EXAMPLE**: ${client.commands.get(command).example}\n\n**ALIASES**: \n${client.commands.get(command).aliases.join(', ')}`);

            const disableButton = new disbut.MessageButton()
                .setStyle('red')
                .setID('disable_' + command)
                .setLabel('Disable this command!');

            helpEmbed.setDescription('```diff\n+ [Command enabled]```')
                     .setColor('GREEN');
            button.message.edit({embed: helpEmbed, button: disableButton})

            button.reply.defer();
        } else {
            console.log('Clicker of ' + button.id + ' doesnt have admin.');
            button.reply.send('You must be an administrator to use that button!');
            return;
        }
    }
});
client.login(token);
