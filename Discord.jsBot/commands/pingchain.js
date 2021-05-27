module.exports = {
    name: 'pingchain',
    description: "Ping a User up to 100 times with configurable delay. \n USAGE: Pingchain @<username> <Pingnumber> <Delay between Pings in milliseconds> \IMPORTANT: The Pings will be automatically deleted after 3 minutes.",
    execute(message, args){

        const Discord = require('discord.js');

        const amount = parseInt(args[1]);
        const second = parseInt(args[2]);
        const user = message.mentions.users.first();

        console.log(message.member.user.tag + ' executed ^Pingchain ' + user.tag + ' ' + amount + ' ' + second);

        if (!user) {
            return message.reply('you need to tag a user!');
        } else if(isNaN(amount)) {
            return message.reply('thats not a number lol');
        } else if (amount < 2 || amount > 100) {
            return message.reply('too high/low')
        }

        let loadingGif = new Discord.MessageAttachment('./loading.gif')

        const LoadingEmbed = new Discord.MessageEmbed()
            .setTitle('Pingchain loading...')
            .attachFiles(loadingGif)
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
