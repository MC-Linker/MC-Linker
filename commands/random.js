module.exports = {
    name: 'random',
    aliases: [''],
    usage: 'random',
    example: 'random',
    description: "Lets the bot send a (funny) random message",
    execute(message, args) {

        console.log(message.member.user.tag + ' executed ^random in ' + message.guild.name)

        const messages = ["what up, GAMERSS", "With ^stats @<username> <Statkategorie> <Statitem/block/entity> you can see your Minecraft Server stats!", "message three", "message four", "With ^Pingchain @<username> <Pinganzahl> <Delay between Pings in millicseconds> you can ping a user up to 100 times. \nThe pings will be automatically deleted after 3 minutes!", "You can send random messages with ^random", "Du Stinkst! \nStärker als Trymacs!!!", "Press Alt+F4 in Minecraft and you will see the Super Secret Settings!", "Press Alt+F4 in Discord and a hilarious secret message from Wumpus will appear.", "How are you? \n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nöüäß", "These messages ain't funny lol :pensive:"]
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        message.channel.send(randomMessage)   
    }
}