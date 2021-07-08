module.exports = {
    name: 'advancements',
    aliases: ['am', 'advancement'],
    usage: 'advancements <@mention>/<ingamename> <advancementTab> <advancementid>',
    example: '^advancements @Lianecx story iron_tools **//** ^advancements @Memer adventure adventuring_time **//** ^advancements xXgamerboyyXx recipes loom',
    description: 'Look up your unlocked/completed recipes/advancements. You can find a list of all advancement (ids) [here](https://minecraft.fandom.com/wiki/Advancement#List_of_advancements).',
    async execute(message, args) {

        const fs = require('fs');
        const ftp = require('../ftpConnect');
        const Discord = require('discord.js');
        const fetch = require('node-fetch');

        if(!args[0]) {
            console.log(message.member.user.tag + ' executed ^stats incorrect!');
            message.reply('<:Error:849215023264169985> Incorrect Usage of command. ^help stats for correct usage.');
            return;
        }

        const mode = (args[1]);
        const object = (args[2]);
        let taggedUser;
        let taggedName;
        let uuidv4;

        if(!message.mentions.users.size) {
            taggedName = (args[0]);
            // @ts-ignore
            try {
                // @ts-ignore
                const minecraftId = await fetch(`https://api.mojang.com/users/profiles/minecraft/${taggedName}`)
                    .then(data => data.json())
                    .then(player => player.id);
                uuidv4 = minecraftId.split('');
                for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');
                uuidv4 = uuidv4.join("");
            } catch (err) {
                message.reply('<:Error:849215023264169985> Player [**' + taggedName + '**] does not seem to exist.')
                console.log('Error getting uuid of ' + taggedName, err)
                return;
            }
        } else {
            taggedUser = message.mentions.users.first();
            taggedName = taggedUser.tag;
            fs.readFile('./connections/' + taggedUser.id + '.json', 'utf8', function(err, connectionJson) {
                if(err) {
                    message.reply(":warning: User isn't connected");
                    console.log('Error reading connectionFile from disk: ', err);
                    return;
                }
                const connectionData = JSON.parse(connectionJson);
                uuidv4 = connectionData.id;
            })
        }

        console.log(message.member.user.tag + ' executed ^advancements ' + mode + ' ' + object +  ' with taggedUser: ' + taggedName + ' in ' + message.guild.name);

        let host;
        let user;
        let pass;
        let port;
        let worldPath;

        try {
            const ftpJson = fs.readFileSync('./ftp/' + message.guild.id + '.json');
            // @ts-ignore
            const ftpData = JSON.parse(ftpJson);
            host = ftpData.host;
            user = ftpData.user;
            pass = ftpData.password;
            port = ftpData.port;
            worldPath = ftpData.path;
        } catch (err) {
            message.reply('<:Error:849215023264169985> ' + 'Could not read ftp credentials. Please contact a server-admin.')
            console.log('Error reading ftp file from disk: ', err);
            return;
        }
        await ftp.get(host, user, pass, port, `${worldPath}/advancements/${uuidv4}.json`, `./stats/${uuidv4}.json`, message);

        fs.readFile('./advancements/' + uuidv4 + '.json', 'utf8', (err, advancementJson) => {
            if(err) {
                message.reply('<:Error:849215023264169985> ' + 'Could not find advancement file. Member most likely never joined the server.')
                console.log('Error reading stat file from disk: ', err);
                return;
            }

            const baseEmbed = new Discord.MessageEmbed()
                .setColor('#730A85')
                .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setTitle(taggedName)
                .addField(`=======================\n${mode} ${object}`, '**=======================**')
                .setImage('https://cdn.discordapp.com/attachments/844493685244297226/849604323264430140/unknown.png')

            try {
                const advancementData = JSON.parse(advancementJson);

                if(mode === 'recipes') {

                    let allKeys = Object.keys(advancementData)
                    const filteredKeys = allKeys.filter(key => {
                        return key.startsWith('minecraft:' + mode + '/') && key.endsWith('/' + object);
                    }).join("")
                    let criteria = Object.keys(advancementData[filteredKeys]['criteria']).join("")
                    let searchName = advancementData[filteredKeys]['criteria'][criteria]
                    searchName = searchName.replace(' +0000', '')

                    console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedName + ' : ' + searchName)
                    const amEmbed = baseEmbed.addField('Criteria', criteria).addField('unlocked on', searchName)
                    message.channel.send(amEmbed)
                } else {
                    try {
                        let searchName;
                        let amEmbed;
                        let key = Object.keys(advancementData['minecraft:' + mode + '/' + object]['criteria'])
                        for (let i=0; i < key.length; i++) {
                            searchName = advancementData['minecraft:' + mode + '/' + object]['criteria'][key[i]]
                            key[i] = key[i].replace('minecraft:', '')
                            searchName = searchName.replace(' +0000', '');
                            amEmbed = baseEmbed.addField('Criteria', key[i], true).addField('completed on', searchName, true).addField('\u200b', '\u200b', true)
                        }
                        console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedName + ' : ' + searchName)
                        message.channel.send(amEmbed)
                    } catch (err) {
                        console.log('Error sending advancement.', err)
                        message.reply(':warning: Advancement [**' + mode + ' ' + object + '**] not completed/unlocked or misspelled!')
                    }
                }

            } catch (err) {
                console.log('Error parsing advancementJSON string: ', err);
                message.reply(':warning: Advancement [**' + mode + ' ' + object + '**] not completed/unlocked or misspelled!')
            }
        })
    }
}