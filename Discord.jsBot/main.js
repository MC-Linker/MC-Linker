console.log('Loading...')

const Discord = require('discord.js')
const { prefix, token } = require('./config.json');
const client = new Discord.Client()
const fs = require('fs');


client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + '!')
    console.log('Der Bot ist auf ' + client.guilds.cache.size + ' servers!')
})

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
} 

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

            const HelpEmbed = new Discord.MessageEmbed()
            .setTitle('Help Menu')
            .setDescription('You can find helpful informations here!')
            .setColor('#000000')
            .setImage("https://cdn.discordapp.com/attachments/838107054290894911/841973239299178526/smp.png")
            .addFields(
                { name: 'PREFIX', value: 'This Bot uses the PREFIX: **^** \nIMPORTANT: Use this PREFIX at the start of every command.'},
                { name: 'HELP', value: 'Useful information about EVERY command. \nUSAGE: help'},
                { name: 'RANDOM', value: client.commands.get('random').description },
                { name: 'STATS', value: client.commands.get('stats').description },
                { name: 'PINGCHAIN', value: client.commands.get('pingchain').description },
                { name: 'FTP', value: client.commands.get('ftp').description },
                { name: 'CONNECT', value: client.commands.get('connect').description },
                { name: 'STATHELP', value: client.commands.get('stathelp').description },
                { name: 'STATDISABLE', value: 'Disable a specific statcategory/item/entity/block. \nIMPORTANT: Renaming the server will result in resetting all disabled stats!\nUSAGE: statdisable category/object <category/item/entity/block> \n EXAMPLE: statdisable category picked_up OR statdisable object blaze OR statdisable object netherite_ingot'},
                { name: 'STATENABLE', value: 'Enable a disabled statcategory/item/entity/block. \nUSAGE: statenable category/object <category/item/entity/block> \n EXAMPLE: e.g. STATDISABLE'},
                { name: 'STATSTATE', value: 'Look at all disabled statcategorys/items/entitys/blocks. \nUSAGE: statstate category/object <category/item/entity/block>/statstate(outputs states of all disabled categorys/objects) \n EXAMPLE: e.g. STATDISABLE'}
            );
                console.log(message.member.user.tag + ' executed ^help')
                message.channel.send(HelpEmbed)

        } else if(command === 'stathelp') {

            client.commands.get('stathelp').execut(message, args);

        } else if(command === 'connect') {

            client.commands.get('connect').execute(message, args);

        } else if(command === 'ftp') {

            client.commands.get('ftp').execute(message, args);

        } else if(command === 'statdisable') {

            client.commands.get('statdisable').execute(message, args);

        } else if(command === 'statenable') {

            client.command.get('statenable').execute(message, args);

        } else if (command === 'statstate') {

            client.commands.get('statstate').execute(message, args);

        }
    })
client.login(process.env.token)

    
