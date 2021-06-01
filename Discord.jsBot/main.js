console.log('Loading...')

const Discord = require('discord.js')
const { prefix, token } = require('./config.json');
const client = new Discord.Client()
const fs = require('fs');


client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + '!')
    console.log('Bot on ' + client.guilds.cache.size + ' servers!')
    client.user.setActivity('^help', {type: "LISTENING"})
})

client.on("guildCreate", guild => {
    console.log("Joined a new guild: " + guild.name + '\nBot is now on ' + client.guilds.cache.size + ' servers!');
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

        if(command === 'pingchain') {
            
            client.commands.get('pingchain').execute(message, args);
            
        } else if(command === 'stats' || command === 'stat') {
                
            client.commands.get('stats').execute(message, args);

        } else if(command === 'random') {

            client.commands.get('random').execute(message, args);

        } else if(command === 'help') {

            const command = (args[0]);

            if(!command) {

                console.log(message.member.user.tag + ' executed ^help without args in ' + message.guild.name)

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
                        { name: 'ADVANCEMENTHELP', value: 'Currently **WIP**' }
                    );
                message.channel.send(HelpEmbed)
            } else {
                try {
                    console.log(message.member.user.tag + ' executed ^help ' + command);

                    const HelpEmbed = new Discord.MessageEmbed()
                        .setTitle('Help Menu')
                        .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                        .setDescription('You can find helpful informations here!')
                        .setColor('#000000')
                        .setImage('https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                        .addFields(
                            { name: command, value: client.commands.get(command).description }
                        );
                    message.channel.send(HelpEmbed)

                } catch (err) {
                    console.log("Command [" + command + "] doesn't exist.");
                    message.channel.send(":warning: Command [" + command + "] doesn't exist.");
                    return;
                }
            }

        } else if(command === 'stathelp') {

            client.commands.get('stathelp').execut(message, args);

        } else if(command === 'connect') {

            client.commands.get('connect').execute(message, args);

        } else if(command === 'ftp') {

            client.commands.get('ftp').execute(message, args);

        } else if(command === 'statdisable' || command === 'statsdisable' || command === 'sd') {

            client.commands.get('statdisable').execute(message, args);

        } else if(command === 'statenable' || command === 'statsenable' || command === 'se') {

            client.commands.get('statenable').execute(message, args);

        } else if (command === 'statstate' || command === 'ss' || command === 'statsstate' || command === 'statstates' || command === 'statsstates') {

            client.commands.get('statstate').execute(message, args);

        } else if (command === 'advancements' || command === 'advancement' || command === 'am') {

            client.commands.get('advancements').execute(message, args);

        }
    })
client.login(process.env.token)

    
