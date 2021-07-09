// @ts-nocheck
console.log('Loading...')

//const Discord = require('discord.js')
const prefix = "^";
const { prefix, token } = require('../config.json');
const client = new Discord.Client()
const fs = require('fs');
const disbut = require('discord-buttons');
disbut(client);

client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + ' and with prefix: ' + prefix)
    console.log('Bot on ' + client.guilds.cache.size + ' server!')
    client.user.setActivity(prefix + 'help', {type: "LISTENING"})
})

client.on("guildCreate", guild => {
    console.log("Joined a new guild: " + guild.name + '\nBot is now on ' + client.guilds.cache.size + ' server!');
})
client.on("guildDelete", guild => {
    console.log("Left a guild: " + guild.name + '\nBot is now on ' + client.guilds.cache.size + ' server!');
})

client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for(const file of commandFiles){
    const command = require(`./commands/${file}`);
 
    client.commands.set(command.name, command);
}

client.on('message', (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if(commandName === 'help') {

        if(!args[0]) {

        console.log(message.member.user.tag + ' executed ^help in ' + message.guild.name)

        let helpEmbed = new Discord.MessageEmbed()
            .setTitle('Help Menu')
            .setDescription('You can find helpful information about EVERY command here!')
            .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
            .setColor('#000000')
            .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png');

        client.commands.forEach(cmd => {
            helpEmbed.addField(cmd.name.toUpperCase(), `${cmd.description}`)
        });

        message.channel.send(helpEmbed);
        } else {
            let command = (args[0]).toLowerCase();
            
            let helpEmbed;
            try {
                command = client.commands.get(command) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(command));
                console.log(message.member.user.tag + ' executed ^help ' + command.name);

                helpEmbed = new Discord.MessageEmbed()
                    .setTitle('Help Menu')
                    .setDescription('You can find helpful information here.')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .setColor('#000000')
                    .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .addField(command.name.toUpperCase(), command.description + `\n\n**USAGE**: \n${command.usage}\n\n**EXAMPLE**: \n${command.example}\n\n**ALIASES**: \n${command.aliases.join(', ')}`);
            } catch (err) {
                console.log("Command [" + args[0] + "] doesn't exist.", err);
                message.reply(":warning: Command [**" + args[0] + "**] doesn't exist.");
                return;
            }

            const disableButton = new disbut.MessageButton()
                .setStyle('red')
                .setID('disable' + command.name)
                .setLabel('Disable this command!');
            const enableButton = new disbut.MessageButton()
                .setStyle('green')
                .setID('enable' + command.name)
                .setLabel('Enable this command!');

            const disabled = fs.existsSync('./disable/command/' + message.guild.id + '_' + command.name);
            if (disabled === false) {
                console.log('disableCommandFile doesnt exist. Command not disabled.');
                message.channel.send({embed: helpEmbed, button: disableButton});
            } else if (disabled === true) {
                helpEmbed.setDescription('You can find helpful information here. \n ```diff\n- [COMMAND DISABLED]```');
                message.channel.send({embed: helpEmbed, button: enableButton});
            }
        }
        return;
    }

    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    fs.access('./disable/command/' + message.guild.id + '_' + command.name, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('Could not find commandDisableFile of command: ' + command.name + ' Command not disabled.');
            try {
                command.execute(message, args);
            } catch (err) {
                console.log(message.member.user.tag + ' executed ^' + command.name + '. Couldnt find that command!', err);
            }
        } else {
            console.log('Command [' + command.name + '] disabled!')
            message.reply(':no_entry: Command [**' + command.name + '**] disabled!');
            return;
        }
    });

})

client.on('clickButton', async (button) => {
    await button.clicker.fetch();

    if (button.id.startsWith('disable')) {

        if (button.clicker.member.hasPermission('ADMINISTRATOR')) {
            const command = button.id.split('disable').pop();
            console.log(button.clicker.user.tag + ' clicked disableButton: ' + command + ' in ' + button.guild.name);
            fs.writeFile('./disable/command/' + button.guild.id + "_" + command, '', err => {
                if (err) {
                    console.log('Error writing commandDisableFile ', err);
                    button.channel.send(`<@${button.clicker.user.id}>, <:Error:849215023264169985> Couldn't disable Command!`);
                    return;
                } else {
                    console.log('Successfully wrote commandDisableFile: ' + './disable/command/' + button.guild.id + "_" + command);
                    button.channel.send(`<@${button.clicker.user.id}>, <:Checkmark:849224496232660992> Disabling of command: [**${command}**] succesful.`);
                }
            })

            helpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setDescription('You can find helpful information here.')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')
                .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .addField(client.commands.get(command).name.toUpperCase(), client.commands.get(command).description + `\n\n**USAGE**: ${client.commands.get(command).usage}\n\n**EXAMPLE**: ${client.commands.get(command).example}\n\n**ALIASES**: \n${client.commands.get(command).aliases.join(', ')}`);

            const enableButton = new disbut.MessageButton()
                .setStyle('green')
                .setID('enable' + command)
                .setLabel('Enable this command!');
            
            helpEmbed.setDescription('You can find helpful information here. \n ```diff\n- [COMMAND DISABLED]```')
                     .setColor('RED');
            button.message.edit({embed: helpEmbed, button: enableButton});

            button.defer();
        } else {
            console.log('Clicker of ' + button.id + ' doesnt have admin.');
            button.reply('You must be an administrator to use that button!');
            return;
        }

    } else if (button.id.startsWith('enable')) {

        if (button.clicker.member.hasPermission('ADMINISTRATOR')) {
            const command = button.id.split('enable').pop();
            console.log(button.clicker.user.tag + ' clicked enableButton: ' + command + ' in ' + button.guild.name);
            fs.unlink('./disable/command/' + button.guild.id + "_" + command, err => {
                if(err) {
                    console.log('Error deleting commandDisableFile ', err);
                    button.channel.send(`<@${button.clicker.user.id}>, <:Error:849215023264169985> Couldn't enable Command! Is it already enabled?`); 
                    return;
                } else {
                    console.log('Successfully deleted commandDisableFile: ' + './disable/command/' + button.guild.id + "_" + command);
                    button.channel.send(`<@${button.clicker.user.id}>, <:Checkmark:849224496232660992> Enabling of command: [**${command}**] succesful.`);
                }
            });
            helpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setDescription('You can find helpful information here.')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')
                .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .addField(client.commands.get(command).name.toUpperCase(), client.commands.get(command).description + `\n\n**USAGE**: ${client.commands.get(command).usage}\n\n**EXAMPLE**: ${client.commands.get(command).example}\n\n**ALIASES**: \n${client.commands.get(command).aliases.join(', ')}`);

            const disableButton = new disbut.MessageButton()
                .setStyle('red')
                .setID('disable' + command)
                .setLabel('Disable this command!');

            helpEmbed.setDescription('You can find helpful information here. \n```diff\n+ [Command enabled]```')
                     .setColor('GREEN');
            button.message.edit({embed: helpEmbed, button: disableButton})

            button.defer();
        } else {
            console.log('Clicker of ' + button.id + ' doesnt have admin.');
            button.reply('You must be an administrator to use that button!');
            return;
        }
    }
});
client.login(process.env.token);
//client.login(token);
