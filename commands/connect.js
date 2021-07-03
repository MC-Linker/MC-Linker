module.exports = {
    name: 'connect',
    aliases: ['connectuser', 'userconnect'],
    usage: 'connect <Minecraftname>',
    example: 'connect Lianecx',
    description: "Connect your minecraft account with your discord account.",
    execute(message, args){

        const fetch = require('node-fetch')
        const fs = require('fs')

        const ingameName = (args[0]);
        
        if(ingameName.startsWith('<@')) {
            console.log(message.member.user.tag + ' executed connect with ping.');
            message.channel.send(`<:Error:849215023264169985> Don't ping someone. Use your minecraft in-game name as argument.`);
            return;
        }

        function getId(playername) {
            // @ts-ignore
            return fetch(`https://api.mojang.com/users/profiles/minecraft/${playername}`)
                .then(data => data.json())
                .then(player => player.id);
        }
        
        getId(ingameName).then(id => {
            message.reply(`<:Checkmark:849224496232660992> Connected with Minecraft-username: **${ingameName}** and UUID: **${id}**`)
            console.log(message.member.user.tag + " connected with uuid: " + id + ' in ' + message.guild.name)
        })

        getId(ingameName).then(id => {
            const connectionJson = {
            "id": id
            }

            const connectionString = JSON.stringify(connectionJson, null, 2);

            fs.writeFile('./connections/' + message.member.user.tag + '.json', connectionString, err => {
                if (err) {
                    console.log('Error writing file', err)
                } else {
                    console.log('Successfully wrote connectionfile')
                }
            })
        });
    }
}