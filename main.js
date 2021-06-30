// @ts-nocheck
console.log('Loading...')

const Discord = require('discord.js')
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

client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for(const file of commandFiles){
    const command = require(`./commands/${file}`);
 
    client.commands.set(command.name, command);
}

client.on('message', (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if(command === 'help') {

            if(!args[0]) {

            console.log(message.member.user.tag + ' executed ^help in ' + message.guild.name)

            const HelpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setDescription('You can find helpful informations here!')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('#000000')
                .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .addFields(
                    { name: 'PREFIX', value: 'This Bot uses the PREFIX: **^** \nIMPORTANT: Use this PREFIX at the start of every command.' },
                    { name: 'HELP', value: 'Useful information about EVERY command. \nUSAGE: help' },
                    { name: 'RANDOM', value: client.commands.get('random').description },
                    { name: 'STATS', value: client.commands.get('stats').description },
                    { name: 'PINGCHAIN', value: client.commands.get('pingchain').description },
                    { name: 'FTP', value: client.commands.get('ftp').description },
                    { name: 'CONNECT', value: client.commands.get('connect').description },
                    { name: 'STATHELP', value: client.commands.get('stathelp').description },
                    { name: 'STATDISABLE', value: client.commands.get('statdisable'.description )},
                    { name: 'STATENABLE', value: client.commands.get('statenable').description },
                    { name: 'STATSTATE', value: client.commands.get('statenable').description },
                    { name: 'ADVANCEMENTS', value: client.commands.get('advancements').description },
                    { name: 'ADVANCEMENTHELP', value: 'Currently **WIP**' },
                    { name: 'TXP', value: client.commands.get('txp').description }
                );
            message.channel.send(HelpEmbed);
        } else {
            const command = (args[0]).toLowerCase();

            console.log(message.member.user.tag + ' executed ^help ' + command);

            let helpEmbed;
            try {
                helpEmbed = new Discord.MessageEmbed()
                    .setTitle('Help Menu')
                    .setDescription('You can find helpful information here.')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .setColor('#000000')
                    .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .addField(command, client.commands.get(command).description);
            } catch (err) {
                console.log("Command [" + command + "] doesn't exist.", err);
                message.reply(":warning: Command [**" + command + "**] doesn't exist.");
                return;
            }

            const disableButton = new disbut.MessageButton()
                .setStyle('red')
                .setID('disable' + command)
                .setLabel('Disable this command!');
            const enableButton = new disbut.MessageButton()
                .setStyle('green')
                .setID('enable' + command)
                .setLabel('Enable this command!');

            const disabled = fs.existsSync('./disable/command/' + message.guild.id + '_' + command);
            if (disabled === false) {
                console.log('disableCommandFile doesnt exist. Command not disabled.')
                message.channel.send('\u200b', {
                    embed: helpEmbed,
                    button: disableButton
                });
            } else if (disabled === true) {
                helpEmbed.setDescription('You can find helpful information here. \n ```diff\n- [COMMAND DISABLED]```');
                message.channel.send('\u200b', {
                    embed: helpEmbed,
                    button: enableButton
                });
            }
        }
        return;
    }
    fs.access('./disable/command/' + message.guild.id + '_' + command, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('Could not find commandDisableFile of command: ' + command + ' Command not disabled.');
            try {
                client.commands.get(command).execute(message, args);
            } catch (err) {
                console.log(message.member.user.tag + ' executed ^' + command + '. Couldnt find that command!');
            }
        } else {
            console.log('Command [' + command + '] disabled!')
            message.reply('<:Error:849215023264169985> Command [**' + command + '**] disabled!');
            return;
        }
    });
})
client.on('clickButton', async (button) => {
    if (button.id.startsWith('disable')) {

        const command = button.id.split('disable').pop();
        console.log(button.clicker.user.tag + ' clicked disableButton: ' + command + ' in ' + button.guild.name);
        fs.writeFile('./disable/command/' + button.guild.id + "_" + command, '', err => {
            if (err) {
                console.log('Error writing commandDisableFile ', err);
                button.channel.send(`<@${button.clicker.user.id}>, <:Error:849215023264169985> Couldn't disable Command!`);
            } else {
                console.log('Successfully wrote commandDisableFile: ' + './disable/command/' + button.guild.id + "_" + command);
                button.channel.send(`<@${button.clicker.user.id}>, <:Checkmark:849224496232660992> Disabling of command: [**${command}**] succesful.`);
            }
        })
        button.defer();
    } else if (button.id.startsWith('enable')) {
        console.log(button.clicker.user.tag + ' clicked enableButton: ' + button.id);

        const command = button.id.split('enable').pop();
        fs.unlink('./disable/command/' + button.guild.id + "_" + command, err => {
            if(err) {
                console.log('Error deleting commandDisableFile ', err);
                button.channel.send(`<@${button.clicker.user.id}>, <:Error:849215023264169985> Couldn't enable Command!`); 
            } else {
                console.log('Successfully deleted commandDisableFile: ' + './disable/command/' + button.guild.id + "_" + command);
                button.channel.send(`<@${button.clicker.user.id}>, <:Checkmark:849224496232660992> Enabling of command: [**${command}**] succesful.`);
            }
        })
        button.defer();
    }
});
client.login(process.env.token);