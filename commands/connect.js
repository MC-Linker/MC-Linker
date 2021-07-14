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
        
        if(!ingameName) {
            console.log(message.member.user.tag + ' executed ^connect without args in ' + message.guild.name);
            message.reply('Please specify your minecraft-name.');
            return;
        }

        if(ingameName.startsWith('<@')) {
            console.log(message.member.user.tag + ' executed connect with ping in ' + message.guild.name);
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
            id = id.split('');
            for(let i = 8; i <=23; i+=5) id.splice(i,0,'-');                       
            id = id.join("");

            console.log(message.member.user.tag + " connected with uuid: " + id + ' in ' + message.guild.name);

            const connectionJson = {
                "id": id
            }

            const connectionString = JSON.stringify(connectionJson, null, 2);

            fs.writeFile('./connections/' + message.member.user.id + '.json', connectionString, err => {
                if (err) {
                    message.channel.send('<:Error:849215023264169985> Error while trying to connect.');
                    console.log('Error writing conectionFile', err);
                    return;
                } else {
                    message.reply(`<:Checkmark:849224496232660992> Connected with Minecraft-username: **${ingameName}** and UUID: **${id}**`);
                    console.log('Successfully wrote connectionfile');
                }
            })
        });
    }
}