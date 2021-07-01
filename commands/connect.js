module.exports = {
    name: 'connect',
    description: "Connect your Discord Account with your Minecraft Account. \n USAGE: connect <Minecraftname>",
    execute(message, args){

        const fetch = require('node-fetch')
        const fs = require('fs')

        const ingameName = (args[0]);

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