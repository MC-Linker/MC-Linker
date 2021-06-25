module.exports = {
    name: 'stathelp',
    description: "Currently WIP, just use this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names) for now.",
    execute(message, args) {

        const Discord = require("discord.js")

        console.log(message.member.user.tag + ' executed ^stathelp in ' + message.guild.name)

        const statHelpEmbed = new Discord.MessageEmbed()
            .setTitle('Stat Help')
            .setDescription('All Stat Categories!')
            .setColor('#000000')
            .addFields(
                {name: 'picked_up', value: 'Counts how often the player picked up an item.'},
                {name: 'WIP', value: `This command is currently WIP. It will be updated soon. Just use this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names) for now`}
            ); 
            message.channel.send(statHelpEmbed)
    }
}

