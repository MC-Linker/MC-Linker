module.exports = {
    name: 'pingchain',
    aliases: ['pc'],
    usage: 'pingchain @<username> <Pingnumber> <delay between pings in seconds>',
    example: 'pingchain @Lianecx 10 1 => Pings @Lianecx 10 times with 1 second delay between pings.',
    description: "Ping a User up to 100 times with configurable delay. \IMPORTANT: The pings will be automatically deleted after 3 minutes.",
    execute(message, args){

        const Discord = require('discord.js');

        async function sleep(msec) {
            return new Promise(resolve => setTimeout(resolve, msec));
        } 

        const amount = parseInt(args[1]);
        const second = parseInt(args[2]);
        const user = message.mentions.users.first();

        console.log(message.member.user.tag + ' executed ^pingchain ' + user.tag + ' ' + amount + ' ' + second + ' in ' + message.guild.name);

        if (!user) {
            return message.reply('<:Error:849215023264169985> ' + 'You need to tag a user!');
        } else if(isNaN(amount)) {
            return message.reply('<:Error:849215023264169985> ' + 'Thats not a number lol');
        } else if (amount < 2 || amount > 100) {
            return message.reply('<:Error:849215023264169985> ' + 'Too high/low')
        }

        const LoadingEmbed = new Discord.MessageEmbed()
            .setTitle('Pingchain loading...')
            .attachFiles(['./loading.gif'])
            .setColor('#5c1204')
            .setImage('attachment://loading.gif');

        message.channel.send(LoadingEmbed)
        .then(message => {
            message.delete({ timeout: 10000})
        })
        .catch(console.error);

        setTimeout(async function() {
            for(let i = 0; i<amount; i++) {
                    message.channel.send(`<@${user.id}>`)
                        .then(message => {
                            message.delete({ timeout: 180000})
                        })
                    .catch(console.error);
                    await sleep(second * 1000)           
            }      
        }, 10000)
    }
}
