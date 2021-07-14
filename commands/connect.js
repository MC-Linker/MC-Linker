module.exports = {
    name: 'connect',
    aliases: ['connectuser', 'userconnect'],
    usage: 'connect <Minecraftname>',
    example: 'connect Lianecx',
    description: "Connect your minecraft account with your discord account.",
    async execute(message, args){

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

        async function getId(playername) {
            try {
                // @ts-ignore
                return await fetch(`https://api.mojang.com/users/profiles/minecraft/${playername}`)
                    .then(data => data.json())
                    .then(player => player.id);
            } catch (err) {
                console.log('Couldnt find Player in mojangAPI [' + playername + ']');
                message.reply('<:Error:849215023264169985> Player [**' + playername + '**] does not seem to exist.');
                return;
            }
        }

        await getId(ingameName).then(id => {
            if(id === undefined) {
                return;
            }
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
                    message.reply('<:Error:849215023264169985> Error trying to connect.');
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